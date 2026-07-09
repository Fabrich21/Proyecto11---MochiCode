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

    // 3. Playbook de Hardware / Sensores (IoT - P08)
    if (this.contieneAlgunaPalabra(texto, ['sensor', 'temperatura', 'temperature', 'iot', 'rango', 'batería', 'hardware', 'dispositivo'])) {
      this.logger.log(`Asignando Playbook de IoT al incidente ${incidente.id}`);
      return [
        'Paso 1: Verificar la telemetría histórica del sensor en la plataforma IoT (P08) para confirmar si es un fallo real o un falso positivo.',
        'Paso 2: Si el sensor marca "fuera de línea", solicitar al personal en terreno la revisión física y posible reinicio del dispositivo.',
        'Paso 3: Si la alerta es de temperatura fuera de rango, alertar inmediatamente a operaciones para resguardar la mercancía.',
        'Paso 4: Si el equipo está dañado, generar ticket de reemplazo con el proveedor de hardware.',
      ];
    }

    // 4. Playbook de Pasarela de Pagos (P04)
    if (this.contieneAlgunaPalabra(texto, ['transaccion', 'transacción', 'pago', 'monto', 'pasarela', 'cobro', 'tarjeta', 'discrepancia'])) {
      this.logger.log(`Asignando Playbook de Pagos al incidente ${incidente.id}`);
      return [
        'Paso 1: Detener preventivamente la liquidación (settlement) de la transacción afectada en la Pasarela (P04).',
        'Paso 2: Verificar la traza completa de la transacción en el portal del adquirente (Transbank/Stripe/etc).',
        'Paso 3: Si hay discrepancia de montos (NOT_EQUAL), iniciar flujo de reverso/devolución por la diferencia hacia el cliente.',
        'Paso 4: Escalar a nivel 2 de finanzas para auditoría manual si el monto comprometido supera el límite automático.',
      ];
    }

    // 5. Playbook de Ruptura Operacional (Stock / Logística)
    if (this.contieneAlgunaPalabra(texto, ['stock', 'ruta', 'inventario', 'retraso', 'vehículo', 'despacho', 'logistica', 'logística'])) {
      this.logger.log(`Asignando Playbook de Operaciones al incidente ${incidente.id}`);
      return [
        'Paso 1: Reasignar recursos o vehículos desde la sucursal o centro de distribución más cercano.',
        'Paso 2: Emitir un ticket preventivo al Proyecto 7 (CRM) para alertar sobre la demora.',
        'Paso 3: Si aplica, enviar notificación automática de disculpas al cliente afectado a través del Proyecto 6.',
        'Paso 4: Re-agendar el servicio o la entrega en la próxima ventana disponible.',
      ];
    }

    // 6. Playbook de Analítica y Datos (P09)
    if (this.contieneAlgunaPalabra(texto, ['dashboard', 'reporte', 'bi', 'data', 'etl', 'extracción', 'analitica', 'analítica'])) {
      this.logger.log(`Asignando Playbook de Analítica al incidente ${incidente.id}`);
      return [
        'Paso 1: Verificar el estado del pipeline ETL/Data Pipeline que alimenta el Dashboard (P09).',
        'Paso 2: Confirmar si hay un bloqueo en la base de datos de origen (Data Warehouse).',
        'Paso 3: Notificar a los stakeholders (gerencia) si el reporte de ventas diario se retrasará.',
        'Paso 4: Forzar el re-procesamiento de los datos del día anterior una vez restaurado el servicio.',
      ];
    }

    // 7. Playbook de Notificaciones y Mensajería (P06)
    if (this.contieneAlgunaPalabra(texto, ['email', 'sms', 'push', 'notificación', 'notificacion', 'mensaje', 'rebote', 'bounce'])) {
      this.logger.log(`Asignando Playbook de Notificaciones al incidente ${incidente.id}`);
      return [
        'Paso 1: Verificar la cuota y el estado del proveedor de envío de correos/SMS (SendGrid, Twilio, etc) en P06.',
        'Paso 2: Revisar si la IP de salida ha sido marcada en alguna lista negra (blacklist).',
        'Paso 3: Redirigir el tráfico de mensajería crítica hacia el proveedor de respaldo (fallback).',
        'Paso 4: Reencolar los mensajes fallidos para que se envíen una vez resuelto el problema.',
      ];
    }

    // 8. Playbook de Triaje General
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
