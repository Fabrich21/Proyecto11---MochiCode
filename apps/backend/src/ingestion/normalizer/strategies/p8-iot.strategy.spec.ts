import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { normalizeP8Iot } from './p8-iot.strategy';

describe('normalizeP8Iot', () => {
  const dto = (payload: Record<string, unknown>): CreateAlertaDto => ({
    sistema_id: 'P8',
    creado_en: '2026-06-28T15:00:00.000Z',
    payload,
  });

  it('normaliza alert_generated en formato plano camelCase como CRITICA y EN_PROGRESO', () => {
    const result = normalizeP8Iot(
      dto({
        eventId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        eventType: 'alert_generated',
        occurredAt: '2026-06-28T15:00:00.000Z',
        source: 'iot-platform',
        sensorId: 'OXI-001',
        alertType: 'oxygen_saturation_low',
        severity: 'critical',
        message: 'Low oxygen saturation: 88%',
      }),
    );

    expect(result.prioridad).toBe('CRITICA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.EN_PROGRESO);
    expect(result.externalId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(result.titulo).toContain('[P8 IoT]');
    expect(result.titulo).toContain('oxygen_saturation_low');
    expect(result.descripcion).toContain('Sensor: OXI-001');
    expect(result.descripcion).toContain('Mensaje: Low oxygen saturation: 88%');
  });

  it('normaliza alert_generated en formato estandar source/event_type/payload', () => {
    const result = normalizeP8Iot(
      dto({
        source: 'iot-platform',
        event_type: 'alert_generated',
        payload: {
          event_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          occurred_at: '2026-06-28T15:00:00.000Z',
          sensor_id: 'OXI-001',
          asset_id: 'PATIENT-001',
          alert_type: 'oxygen_saturation_low',
          severity: 'critical',
          message: 'Low oxygen saturation: 88%',
        },
      }),
    );

    expect(result.prioridad).toBe('CRITICA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.EN_PROGRESO);
    expect(result.externalId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(result.descripcion).toContain('Asset: PATIENT-001');
  });

  it('normaliza telemetry_received offline como ALTA', () => {
    const result = normalizeP8Iot(
      dto({
        eventId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        eventType: 'telemetry_received',
        occurredAt: '2026-06-28T15:00:00.000Z',
        source: 'iot-platform',
        sensorId: 'OXI-001',
        assetId: 'PATIENT-001',
        sensorType: 'pulse_oximeter',
        batteryLevel: 85,
        connectionStatus: 'offline',
        oxygenSaturation: 96,
        heartRate: 82,
      }),
    );

    expect(result.prioridad).toBe('ALTA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.ABIERTO);
    expect(result.titulo).toContain('Telemetria pulse_oximeter');
  });

  it('normaliza telemetry_received connected como BAJA', () => {
    const result = normalizeP8Iot(
      dto({
        eventId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        eventType: 'telemetry_received',
        occurredAt: '2026-06-28T15:00:00.000Z',
        source: 'iot-platform',
        sensorId: 'OXI-001',
        assetId: 'PATIENT-001',
        sensorType: 'pulse_oximeter',
        batteryLevel: 85,
        connectionStatus: 'connected',
        oxygenSaturation: 96,
        heartRate: 82,
      }),
    );

    expect(result.prioridad).toBe('BAJA');
    expect(result.estadoSugerido).toBe(IncidenteEstado.ABIERTO);
  });
});
