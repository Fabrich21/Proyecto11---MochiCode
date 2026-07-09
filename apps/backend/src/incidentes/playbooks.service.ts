import { Injectable, Logger } from '@nestjs/common';
import { Incidente } from '../database/entities/incidente.entity';

@Injectable()
export class PlaybooksService {
  private readonly logger = new Logger(PlaybooksService.name);

  obtenerPlaybookParaIncidente(incidente: Incidente): string[] {
    const titulo = incidente.titulo.toLowerCase();
    const descripcion = (incidente.descripcion || '').toLowerCase();
    const texto = `${titulo} ${descripcion}`;

    // 1. Playbook de Falla de Conectividad / Infraestructura
    if (this.contieneAlgunaPalabra(texto, ['timeout', 'conexión', 'conexion', 'caída', '503', 'servidor', 'base de datos', 'network'])) {
      this.logger.log(`Asignando Playbook de Conectividad al incidente ${incidente.id}`);
      return [
        'Paso 1: Verificar logs de red y estado de balanceadores en Datadog/Kibana.',
        'Paso 2: Revisar estado del pod o instancia EC2 correspondiente en Kubernetes/AWS.',
        'Paso 3: Si la interrupción supera los 5 minutos, escalar inmediatamente al equipo DevOps o SRE de turno.',
        'Paso 4: Una vez restaurado, confirmar con el sistema origen que los reintentos automáticos están fluyendo.',
      ];
    }

    // 2. Playbook de Incidente de Seguridad / Fraude
    if (this.contieneAlgunaPalabra(texto, ['fraude', 'acceso', 'token', 'rechazo', 'anómalo', 'anomalo', 'vulnerabilidad', 'seguridad', 'password'])) {
      this.logger.log(`Asignando Playbook de Seguridad al incidente ${incidente.id}`);
      return [
        'Paso 1: Bloquear cuenta de usuario o IP origen preventivamente usando el portal administrativo.',
        'Paso 2: Solicitar revisión de logs de autenticación al Proyecto 12 (Identidad).',
        'Paso 3: Notificar al CISO (Chief Information Security Officer) sobre el posible incidente de seguridad.',
        'Paso 4: Invalidar todos los tokens activos asociados al sistema comprometido.',
      ];
    }

    // 3. Playbook de Ruptura Operacional (Stock / Logística)
    if (this.contieneAlgunaPalabra(texto, ['stock', 'ruta', 'inventario', 'retraso', 'vehículo', 'despacho', 'logistica', 'logística'])) {
      this.logger.log(`Asignando Playbook de Operaciones al incidente ${incidente.id}`);
      return [
        'Paso 1: Reasignar recursos o vehículos desde la sucursal o centro de distribución más cercano.',
        'Paso 2: Emitir un ticket preventivo al Proyecto 7 (CRM) para alertar sobre la demora.',
        'Paso 3: Si aplica, enviar notificación automática de disculpas al cliente afectado a través del Proyecto 6.',
        'Paso 4: Re-agendar el servicio o la entrega en la próxima ventana disponible.',
      ];
    }

    // 4. Playbook de Triaje General
    this.logger.log(`Asignando Playbook de Triaje General al incidente ${incidente.id}`);
    return [
      'Paso 1: Confirmar con el sistema origen si el error persiste o fue un fallo transitorio.',
      'Paso 2: Recabar logs adicionales de la aplicación afectada.',
      'Paso 3: Asignar a soporte Nivel 2 para investigación manual profunda.',
      'Paso 4: Actualizar el estado del incidente a EN_PROGRESO para evitar vencimiento de SLA inicial.',
    ];
  }

  private contieneAlgunaPalabra(texto: string, palabras: string[]): boolean {
    return palabras.some((palabra) => texto.includes(palabra));
  }
}
