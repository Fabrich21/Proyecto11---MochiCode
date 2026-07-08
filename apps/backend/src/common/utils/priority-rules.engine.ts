/**
 * Motor de reglas para calcular la criticidad/prioridad de un incidente
 * basándose en su origen (sistema).
 */
export class PriorityRulesEngine {
  /**
   * Mapeo estático de sistemas a niveles de prioridad por defecto.
   */
  private static readonly REGLAS_ORIGEN: Record<string, string> = {
    'P1': 'CRITICA',
    'P2': 'ALTA',
    'P7': 'CRITICA',
    'P07': 'CRITICA',
    'P8': 'BAJA',
    'P9': 'MEDIA',
    'P12': 'ALTA',
  };

  /**
   * Calcula la prioridad asignada a un webhook.
   *
   * @param sistemaId Identificador del sistema de origen
   * @param payload Payload original del webhook
   * @returns Nivel de prioridad final
   */
  static calcularPrioridad(sistemaId: string, payload?: any): string {
    const sistema = sistemaId?.toUpperCase();

    // Reglas específicas para Salud (P1).
    if (sistema === 'P1' || sistema === 'P01') {
      const severity = payload?.severity;
      const eventType = payload?.eventType;
      
      if (severity === 'critical') return 'CRITICA';
      if (severity === 'high') return 'ALTA';
      if (severity === 'medium') return 'MEDIA';
      if (severity === 'low') return 'BAJA';

      if (eventType === 'offline_sync_failed' || eventType === 'visit_not_registered' || eventType === 'professional_no_show') {
        return 'ALTA';
      }
      return 'MEDIA';
    }

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
    if (sistema === 'P8' || sistema === 'P08') {
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

    // Default si no hay regla específica para el origen
    return 'MEDIA';
  }
}
