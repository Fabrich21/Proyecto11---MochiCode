import { Injectable, Logger } from '@nestjs/common';
import { CreateAlertaDto } from '../dto/create-alerta.dto';
import { NormalizedAlerta } from '../dto/normalized-alerta.dto';
import { normalizeP9Analitica } from './strategies/p9-analitica.strategy';
import { normalizeP1Salud } from './strategies/p1-salud.strategy';
import { normalizeP5Inventario } from './strategies/p5-inventario.strategy';
import { normalizeP8Iot } from './strategies/p8-iot.strategy';
import { normalizeP3Pedidos } from './strategies/p3-pedidos.strategy';
import { normalizeP4Pasarela } from './strategies/p4-pasarela.strategy';
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
    // Grupo 1 — Salud
    // Formato: { eventId, source, eventType, occurredAt, severity, status, ... }
    P1: normalizeP1Salud,

    // Grupo 3 — Pedidos
    // Formato: { source, event_type, payload: { order_id, customer_id, ... } }
    P3: normalizeP3Pedidos,

    // Grupo 4 — Pasarela de pagos
    // Formato: { tipo, error, id_transaccion, ... } y conciliaciones
    P4: normalizeP4Pasarela,
    P04: normalizeP4Pasarela,

    // Grupo 5 — Inventario
    // Formato: { source, event_type, project_id, created_at, payload: { ... } }
    P5: normalizeP5Inventario,

    // Grupo 8 — IoT
    // Formato soportado:
    //  - Plano camelCase: { eventId, eventType, occurredAt, source, ... }
    //  - Estandarizado:     { source, event_type, payload: { event_id, ... } }
    P8: normalizeP8Iot,

    // Grupo 9 — Analítica
    // Formato: { source, event_type, payload: { incident_id, severity, status, ... } }
    P9: normalizeP9Analitica,
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
