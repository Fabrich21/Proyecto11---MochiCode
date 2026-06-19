import { Injectable, Logger } from '@nestjs/common';
import { CreateAlertaDto } from '../dto/create-alerta.dto';
import { NormalizedAlerta } from '../dto/normalized-alerta.dto';
import { normalizeP9Grupo9 } from './strategies/p9-grupo9.strategy';
import { normalizeDefault } from './strategies/default.strategy';

/**
 * Servicio que despacha la normalización al estrategia correcta según sistema_id.
 *
 * Para agregar un nuevo sistema:
 *  1. Crear src/ingestion/normalizer/strategies/pX.strategy.ts
 *  2. Importar la función aquí
 *  3. Añadir la entrada al mapa STRATEGIES
 */
@Injectable()
export class PayloadNormalizerService {
  private readonly logger = new Logger(PayloadNormalizerService.name);

  /**
   * Mapa sistema_id → función normalizadora.
   * Las claves deben coincidir exactamente con el campo sistema_id del DTO
   * (que a su vez es validado por el ZeroTrustGuard).
   */
  private readonly STRATEGIES: Record<
    string,
    (dto: CreateAlertaDto) => NormalizedAlerta
  > = {
    // Grupo 9 — Analítica
    // Formato: { source, event_type, payload: { incident_id, severity, status, ... } }
    P9: normalizeP9Grupo9,
  };

  /**
   * Normaliza el payload de `dto` al esquema interno.
   * Si el sistema no tiene estrategia registrada, aplica el fallback genérico.
   */
  normalize(dto: CreateAlertaDto): NormalizedAlerta {
    const strategy = this.STRATEGIES[dto.sistema_id];

    if (!strategy) {
      this.logger.warn(
        `Sin estrategia de normalización para "${dto.sistema_id}". Usando fallback genérico.`,
      );
      return normalizeDefault(dto);
    }

    this.logger.debug(`Normalizando payload de "${dto.sistema_id}" con estrategia específica.`);
    return strategy(dto);
  }
}
