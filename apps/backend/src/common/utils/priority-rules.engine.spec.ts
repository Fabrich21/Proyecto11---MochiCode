import { PriorityRulesEngine } from './priority-rules.engine';

describe('PriorityRulesEngine', () => {
  it('retorna CRITICA para P04 Transaccion NOT_EQUAL', () => {
    const prioridad = PriorityRulesEngine.calcularPrioridad('P04', {
      tipo: 'Transaccion',
      error: 'NOT_EQUAL',
    });

    expect(prioridad).toBe('CRITICA');
  });

  it('retorna ALTA para P4 Transaccion RETRY_WARNING', () => {
    const prioridad = PriorityRulesEngine.calcularPrioridad('P4', {
      tipo: 'Transaccion',
      error: 'RETRY_WARNING',
    });

    expect(prioridad).toBe('ALTA');
  });

  it('retorna MEDIA para P04 Conciliacion EXISTE_EN_BANCO', () => {
    const prioridad = PriorityRulesEngine.calcularPrioridad('P04', {
      tipo: 'Conciliacion',
      tipo_discrepancia: 'EXISTE_EN_BANCO',
    });

    expect(prioridad).toBe('MEDIA');
  });

  it('retorna CRITICA para P3 pago_fallido', () => {
    const prioridad = PriorityRulesEngine.calcularPrioridad('P3', {
      event_type: 'pago_fallido',
    });

    expect(prioridad).toBe('CRITICA');
  });

  it('retorna BAJA para P3 pedido_pagado', () => {
    const prioridad = PriorityRulesEngine.calcularPrioridad('P3', {
      event_type: 'pedido_pagado',
    });

    expect(prioridad).toBe('BAJA');
  });

  it('retorna CRITICA para P8 alert_generated critical (camelCase)', () => {
    const prioridad = PriorityRulesEngine.calcularPrioridad('P8', {
      eventType: 'alert_generated',
      severity: 'critical',
    });

    expect(prioridad).toBe('CRITICA');
  });

  it('retorna CRITICA para P8 alert_generated critical (snake_case envelope)', () => {
    const prioridad = PriorityRulesEngine.calcularPrioridad('P8', {
      event_type: 'alert_generated',
      payload: {
        severity: 'critical',
      },
    });

    expect(prioridad).toBe('CRITICA');
  });

  it('retorna ALTA para P8 telemetry offline', () => {
    const prioridad = PriorityRulesEngine.calcularPrioridad('P8', {
      eventType: 'telemetry_received',
      connectionStatus: 'offline',
    });

    expect(prioridad).toBe('ALTA');
  });

  it('calcula prioridad dinamica para P1 segun severity', () => {
    const prioridad = PriorityRulesEngine.calcularPrioridad('P1', { severity: 'critical' });
    expect(prioridad).toBe('CRITICA');
    
    const prioridadMedia = PriorityRulesEngine.calcularPrioridad('P1', {});
    expect(prioridadMedia).toBe('MEDIA');
  });
});
