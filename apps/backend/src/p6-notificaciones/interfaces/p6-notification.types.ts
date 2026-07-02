export type P6NotificationChannel = 'email' | 'sms';

export interface P6EmailPayload {
  channel: 'email';
  recipient: {
    email: string;
    telefono?: string;
  };
  subject: string;
  body: {
    email: string;
    sms?: string;
  };
}

export interface P6SmsPayload {
  channel: 'sms';
  recipient: {
    telefono: string;
  };
  body: {
    sms: string;
  };
}

export type P6NotificationPayload = P6EmailPayload | P6SmsPayload;

export interface EnviarEmailAsignacionParams {
  email: string;
  incidenteId: string;
  titulo: string;
  asignadoAUsuarioId: string;
}

export interface EnviarNotificacionSlaParams {
  telefono: string;
  incidenteId: string;
  titulo: string;
  usuarioDestinoId: string;
}
