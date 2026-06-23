import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // En producción debería restringirse al dominio del frontend
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  // Permitir que los clientes se unan a salas específicas
  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
    client.join(room);
    this.logger.log(`Cliente ${client.id} se unió a la sala: ${room}`);
    return { event: 'joinedRoom', data: room };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
    client.leave(room);
    this.logger.log(`Cliente ${client.id} abandonó la sala: ${room}`);
    return { event: 'leftRoom', data: room };
  }

  // Métodos que los servicios (Worker, Incidentes) llamarán para emitir a salas
  emitNuevoIncidente(incidente: any) {
    this.logger.debug(`Emitiendo nuevo_incidente al dashboard_incidentes`);
    this.server.to('dashboard_incidentes').emit('nuevo_incidente', incidente);
  }

  emitIncidenteActualizado(incidenteId: string, data: any) {
    this.logger.debug(`Emitiendo incidente_actualizado para ${incidenteId}`);
    this.server.to('dashboard_incidentes').emit('incidente_actualizado', {
      incidenteId,
      ...data,
    });
  }

  emitEstadoActualizado(incidenteId: string, nuevoEstado: string) {
    this.logger.debug(`Emitiendo estado_actualizado para ${incidenteId}: ${nuevoEstado}`);
    this.server.to('dashboard_incidentes').emit('estado_actualizado', {
      incidenteId,
      nuevoEstado,
    });
  }
}
