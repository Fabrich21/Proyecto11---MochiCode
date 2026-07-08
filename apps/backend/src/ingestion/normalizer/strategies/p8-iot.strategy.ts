import { IncidenteEstado } from '@proyecto/shared-types';
import { CreateAlertaDto } from '../../dto/create-alerta.dto';
import { NormalizedAlerta } from '../../dto/normalized-alerta.dto';

type IotEventType = 'alert_generated' | 'telemetry_received' | 'alert_resolved';
type IotSeverity = 'warning' | 'critical' | 'resolved';
type IotConnectionStatus = 'connected' | 'offline';
type IotSensorType =
  | 'thermometer'
  | 'glucometer'
  | 'pulse_oximeter'
  | 'sphygmomanometer';

interface IotInnerPayload {
  event_id?: string;
  occurred_at?: string;
  sensor_id?: string;
  asset_id?: string;
  alert_type?: string;
  severity?: IotSeverity;
  message?: string;

  sensor_type?: IotSensorType;
  battery_level?: number;
  connection_status?: IotConnectionStatus;
  temperature?: number;
  glucose_level?: number;
  oxygen_saturation?: number;
  heart_rate?: number;
  systolic_pressure?: number;
  diastolic_pressure?: number;
}

interface IotEnvelope {
  source?: string;
  event_type?: IotEventType;
  payload?: IotInnerPayload;
}

interface IotFlatPayload {
  eventId?: string;
  eventType?: IotEventType;
  occurredAt?: string;
  source?: string;
  sensorId?: string;
  assetId?: string;
  alertType?: string;
  severity?: IotSeverity;
  message?: string;

  sensorType?: IotSensorType;
  batteryLevel?: number;
  connectionStatus?: IotConnectionStatus;
  temperature?: number;
  glucoseLevel?: number;
  oxygenSaturation?: number;
  heartRate?: number;
  systolicPressure?: number;
  diastolicPressure?: number;
}

type IotNormalizedInput = {
  source?: string;
  eventType?: IotEventType;
  eventId?: string;
  occurredAt?: string;
  sensorId?: string;
  assetId?: string;
  alertType?: string;
  severity?: IotSeverity;
  message?: string;
  sensorType?: IotSensorType;
  batteryLevel?: number;
  connectionStatus?: IotConnectionStatus;
  temperature?: number;
  glucoseLevel?: number;
  oxygenSaturation?: number;
  heartRate?: number;
  systolicPressure?: number;
  diastolicPressure?: number;
};

export function normalizeP8Iot(dto: CreateAlertaDto): NormalizedAlerta {
  const raw = dto.payload as IotEnvelope | IotFlatPayload;
  const input = normalizeInput(raw);

  const prioridad = inferPriority(input);
  const estadoSugerido = inferState(input);

  return {
    titulo: buildTitulo(input),
    descripcion: buildDescripcion(input),
    prioridad,
    estadoSugerido,
    externalId: input.eventId,
  };
}

function normalizeInput(raw: IotEnvelope | IotFlatPayload): IotNormalizedInput {
  const envelope = raw as IotEnvelope;

  if (envelope?.payload && envelope?.event_type) {
    const p = envelope.payload;

    return {
      source: envelope.source,
      eventType: envelope.event_type,
      eventId: p.event_id,
      occurredAt: p.occurred_at,
      sensorId: p.sensor_id,
      assetId: p.asset_id,
      alertType: p.alert_type,
      severity: p.severity,
      message: p.message,
      sensorType: p.sensor_type,
      batteryLevel: p.battery_level,
      connectionStatus: p.connection_status,
      temperature: p.temperature,
      glucoseLevel: p.glucose_level,
      oxygenSaturation: p.oxygen_saturation,
      heartRate: p.heart_rate,
      systolicPressure: p.systolic_pressure,
      diastolicPressure: p.diastolic_pressure,
    };
  }

  const flat = raw as IotFlatPayload;

  return {
    source: flat.source,
    eventType: flat.eventType,
    eventId: flat.eventId,
    occurredAt: flat.occurredAt,
    sensorId: flat.sensorId,
    assetId: flat.assetId,
    alertType: flat.alertType,
    severity: flat.severity,
    message: flat.message,
    sensorType: flat.sensorType,
    batteryLevel: flat.batteryLevel,
    connectionStatus: flat.connectionStatus,
    temperature: flat.temperature,
    glucoseLevel: flat.glucoseLevel,
    oxygenSaturation: flat.oxygenSaturation,
    heartRate: flat.heartRate,
    systolicPressure: flat.systolicPressure,
    diastolicPressure: flat.diastolicPressure,
  };
}

function inferPriority(input: IotNormalizedInput): NormalizedAlerta['prioridad'] {
  if (input.eventType === 'alert_generated') {
    if (input.severity === 'critical') return 'CRITICA';
    if (input.severity === 'warning') return 'MEDIA';
    return 'MEDIA';
  }

  if (input.eventType === 'telemetry_received') {
    if (input.connectionStatus === 'offline') return 'ALTA';
    if (input.batteryLevel != null && input.batteryLevel <= 15) return 'ALTA';
    return 'BAJA';
  }

  return 'MEDIA';
}

function inferState(input: IotNormalizedInput): IncidenteEstado {
  if (input.eventType === 'alert_resolved' || input.severity === 'resolved') {
    return IncidenteEstado.CERRADO;
  }

  if (input.eventType === 'alert_generated') {
    return input.severity === 'critical'
      ? IncidenteEstado.EN_PROGRESO
      : IncidenteEstado.ABIERTO;
  }

  if (input.eventType === 'telemetry_received' && input.connectionStatus === 'connected') {
    return IncidenteEstado.ABIERTO;
  }

  return IncidenteEstado.ABIERTO;
}

function buildTitulo(input: IotNormalizedInput): string {
  if (input.eventType === 'alert_generated' || input.eventType === 'alert_resolved' || input.severity === 'resolved') {
    const alert = input.alertType ?? 'alerta_iot';
    const sensor = input.sensorId ? ` | Sensor ${input.sensorId}` : '';
    return `[P8 IoT] Alerta ${alert}${sensor}`;
  }

  if (input.eventType === 'telemetry_received') {
    const sensorType = input.sensorType ?? 'sensor';
    const sensor = input.sensorId ? ` | ${input.sensorId}` : '';
    return `[P8 IoT] Telemetria ${sensorType}${sensor}`;
  }

  return '[P8 IoT] Evento operacional';
}

function buildDescripcion(input: IotNormalizedInput): string {
  const lines: string[] = [];

  if (input.eventId) lines.push(`ID externo IoT: ${input.eventId}`);
  if (input.source) lines.push(`Origen: ${input.source}`);
  if (input.eventType) lines.push(`Tipo: ${input.eventType}`);
  if (input.occurredAt) lines.push(`Ocurrido en: ${input.occurredAt}`);
  if (input.sensorId) lines.push(`Sensor: ${input.sensorId}`);
  if (input.assetId) lines.push(`Asset: ${input.assetId}`);
  if (input.sensorType) lines.push(`Tipo sensor: ${input.sensorType}`);

  if (input.alertType) lines.push(`Tipo alerta: ${input.alertType}`);
  if (input.severity) lines.push(`Severidad: ${input.severity}`);
  if (input.message) lines.push(`Mensaje: ${input.message}`);

  if (input.connectionStatus) lines.push(`Conexion: ${input.connectionStatus}`);
  if (input.batteryLevel != null) lines.push(`Bateria: ${input.batteryLevel}%`);
  if (input.temperature != null) lines.push(`Temperatura: ${input.temperature} C`);
  if (input.glucoseLevel != null) lines.push(`Glucosa: ${input.glucoseLevel} mg/dL`);
  if (input.oxygenSaturation != null) {
    lines.push(`Saturacion O2: ${input.oxygenSaturation}%`);
  }
  if (input.heartRate != null) lines.push(`FC: ${input.heartRate} bpm`);
  if (input.systolicPressure != null) lines.push(`PA sistolica: ${input.systolicPressure}`);
  if (input.diastolicPressure != null) {
    lines.push(`PA diastolica: ${input.diastolicPressure}`);
  }

  return lines.join(' | ');
}
