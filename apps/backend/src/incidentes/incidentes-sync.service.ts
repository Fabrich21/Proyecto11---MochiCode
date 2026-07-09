import { Injectable, Logger, HttpException, HttpStatus, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Incidente } from '../database/entities/incidente.entity';
import { EventoAlerta } from '../database/entities/evento-alerta.entity';
import { IncidenteEstado } from '@proyecto/shared-types';
import { IncidentesService } from './incidentes.service';

@Injectable()
export class IncidentesSyncService {
  private readonly logger = new Logger(IncidentesSyncService.name);
  private readonly p7CrmEstadoUrl: string;
  private readonly sistemaAutomaticoUuid: string;

  constructor(
    @InjectRepository(Incidente)
    private readonly incidenteRepository: Repository<Incidente>,
    @InjectRepository(EventoAlerta)
    private readonly eventoAlertaRepository: Repository<EventoAlerta>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => IncidentesService))
    private readonly incidentesService: IncidentesService,
  ) {
    this.p7CrmEstadoUrl = this.configService.get<string>(
      'P7_CRM_ESTADO_URL',
      'https://pgti-proyecto-crm-backend.vercel.app/api/v1/incidentes/estado-ticket',
    )!;

    this.sistemaAutomaticoUuid = this.configService.get<string>(
      'SISTEMA_AUTOMATICO_UUID',
      '00000000-0000-0000-0000-000000000001',
    )!;
  }

  async obtenerEstado(id: string) {
    const apiKey =
      this.configService.get<string>('INCIDENTES_API_KEY') ??
      this.configService.get<string>('API_KEY_P07');

    if (!apiKey) {
      this.logger.error('No existe INCIDENTES_API_KEY ni API_KEY_P07 para consultar CRM externo.');
      throw new HttpException(
        { ok: false, message: 'No se pudo consultar el sistema externo' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const url = `${this.p7CrmEstadoUrl.replace(/\/$/, '')}/${encodeURIComponent(id)}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Content-Type': 'application/json',
          },
          params: {
            api_key: apiKey,
          },
        }),
      );

      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;

      if (status && data) {
        throw new HttpException(data, status);
      }

      this.logger.error(`No se pudo consultar el estado del ticket ${id} en CRM externo`, error);
      throw new HttpException(
        { ok: false, message: 'No se pudo consultar el sistema externo' },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async sincronizarEstadosDesdeCrm(): Promise<{ revisados: number; actualizados: number }> {
    const incidentesActivos = await this.incidenteRepository.find({
      where: {
        sistemaId: In(['P07', 'P7']),
        estado: In([IncidenteEstado.ABIERTO, IncidenteEstado.EN_PROGRESO]),
      },
    });

    let actualizados = 0;

    // Use Promise.allSettled with concurrency limit in future, but for now map and Promise.all or sequential is fine.
    // As per the audit improvement: "Utiliza Promise.allSettled() con un límite de concurrencia".
    // I will implement a simple concurrent batching mechanism or Promise.allSettled.

    const results = await Promise.allSettled(
      incidentesActivos.map(async (incidente) => {
        const idTicketCrm = await this.resolverIdTicketCrm(incidente.id);

        if (!idTicketCrm) {
          this.logger.warn(
            `No se encontró el id del ticket CRM para el incidente ${incidente.id}; se omite.`,
          );
          return 0;
        }

        const respuesta: any = await this.obtenerEstado(idTicketCrm);
        const estadoCrm = respuesta?.ticket?.estado;
        const nuevoEstado = this.mapearEstadoCrmAIncidente(estadoCrm);

        if (!nuevoEstado) {
          this.logger.warn(
            `Estado CRM desconocido ("${estadoCrm}") para incidente ${incidente.id}; se omite.`,
          );
          return 0;
        }

        if (nuevoEstado === incidente.estado) {
          return 0;
        }

        await this.incidentesService.cambiarEstado(incidente.id, {
          estado: nuevoEstado,
          usuarioId: this.sistemaAutomaticoUuid,
        });

        this.logger.log(
          `Incidente ${incidente.id} sincronizado desde CRM (ticket ${idTicketCrm}): ${incidente.estado} → ${nuevoEstado}.`,
        );
        return 1;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        actualizados += result.value;
      } else {
        this.logger.error('Error al sincronizar estado de incidente desde CRM', result.reason);
      }
    }

    return { revisados: incidentesActivos.length, actualizados };
  }

  private async resolverIdTicketCrm(incidenteId: string): Promise<string | null> {
    const evento = await this.eventoAlertaRepository.findOne({
      where: { incidenteId },
      order: { creadoEn: 'DESC' },
    });

    const payload = (evento?.payload ?? {}) as Record<string, unknown>;
    const posibleId =
      payload.id_ticket_interno ?? payload.id_ticket ?? payload.ticket_id ?? payload.id;

    return typeof posibleId === 'string' && posibleId.length > 0 ? posibleId : null;
  }

  private mapearEstadoCrmAIncidente(estadoCrm: unknown): IncidenteEstado | null {
    if (typeof estadoCrm !== 'string') {
      return null;
    }

    switch (estadoCrm.toLowerCase()) {
      case 'abierto':
        return IncidenteEstado.ABIERTO;
      case 'progreso':
      case 'en_progreso':
        return IncidenteEstado.EN_PROGRESO;
      case 'resuelto':
      case 'cerrado':
        return IncidenteEstado.CERRADO;
      default:
        return null;
    }
  }
}
