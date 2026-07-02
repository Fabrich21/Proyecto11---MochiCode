/**
 * Motor de reglas para calcular la criticidad/prioridad de un incidente
 * basándose en su origen (sistema).
 */
export class PriorityRulesEngine {
  /**
   * Mapeo estático de sistemas a su Trust Level (Nivel Máximo de Confianza).
   * Define hasta qué nivel de prioridad le permitimos a un sistema declarar.
   */
  private static readonly TRUST_LEVELS: Record<string, string> = {
    'P1': 'CRITICA', // P1 puede emitir hasta CRITICA
    'P2': 'ALTA',    // P2 puede emitir hasta ALTA
    'P4': 'ALTA',    // Pagos puede emitir hasta ALTA
    'P7': 'CRITICA', // CRM (P07) es confiable, puede emitir CRITICA
    'P07': 'CRITICA', // Alias para P7
    'P8': 'BAJA',    // IoT solo puede emitir BAJA (sin importar lo que sugiera)
    'P9': 'MEDIA',   // Analítica hasta MEDIA
    'P12': 'ALTA',   // SSO hasta ALTA
  };

  private static readonly PRIORIDAD_PESO: Record<string, number> = {
    'CRITICA': 4,
    'ALTA': 3,
    'MEDIA': 2,
    'BAJA': 1,
  };

  /**
   * Calcula la prioridad asignada a un webhook usando Trust Levels.
   *
   * @param sistemaId Identificador del sistema de origen
   * @param prioridadSugerida Prioridad inferida por el Normalizador
   * @returns Nivel de prioridad final asignado
   */
  static calcularPrioridad(sistemaId: string, payload?: any): string {
    const sistema = sistemaId?.toUpperCase();

    // Reglas específicas para Pasarela (P4/P04).
    if (sistema === 'P4' || sistema === 'P04') {
      const tipo = payload?.tipo;
      const error = payload?.error;
      const tipoDiscrepancia = payload?.tipo_discrepancia;

      if (tipo === 'Transaccion' && error === 'NOT_EQUAL') {
        return 'CRITICA';
      }

      if (tipo === 'Transaccion' && error === 'RETRY_WARNING') {
        return 'ALTA';
      }

      if (tipo === 'Conciliacion') {
        if (tipoDiscrepancia === 'DIFERENCIA_DE_MONTO') return 'CRITICA';
        if (tipoDiscrepancia === 'FALTANTE_EN_BANCO') return 'ALTA';
        if (tipoDiscrepancia === 'EXISTE_EN_BANCO') return 'MEDIA';
      }

      return 'MEDIA';
    }

    // Reglas específicas para Pedidos (P3): priorizamos por tipo de evento.
    if (sistema === 'P3') {
      const eventType = payload?.event_type;

      if (eventType === 'pago_fallido' || eventType === 'stock_agotado') {
        return 'CRITICA';
      }

      if (
        eventType === 'stock_reservado' ||
        eventType === 'listo_para_despacho' ||
        eventType === 'pedido_en_transito'
      ) {
        return 'MEDIA';
      }

      if (
        eventType === 'pedido_creado' ||
        eventType === 'pedido_pagado' ||
        eventType === 'pedido_entregado'
      ) {
        return 'BAJA';
      }

      return 'MEDIA';
    }

    // Reglas específicas para IoT (P8): priorizamos por severidad operacional.
    if (sistema === 'P8') {
      const eventType = payload?.eventType ?? payload?.event_type;
      const severity = payload?.severity ?? payload?.payload?.severity;
      const connectionStatus =
        payload?.connectionStatus ?? payload?.payload?.connection_status;

      if (eventType === 'alert_generated') {
        if (severity === 'critical') return 'CRITICA';
        if (severity === 'warning') return 'MEDIA';
      }

      if (eventType === 'telemetry_received') {
        if (connectionStatus === 'offline') return 'ALTA';
        return 'BAJA';
      }

      return 'BAJA';
    }

    // Si el origen tiene una regla definida, la retornamos
    const regla = this.REGLAS_ORIGEN[sistema];
    
    if (regla) {
      return regla;
    }

    // Si la sugerida es menor o igual a su Trust Level, se la respetamos.
    // Si intenta pedir más prioridad de la que tiene permitida, la limitamos a su Max Trust.
    return pesoSugerido <= pesoMaximo ? sugerida : maxTrust;
  }
}
