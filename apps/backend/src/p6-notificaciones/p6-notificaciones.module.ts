import { Global, Module } from '@nestjs/common';
import { P6NotificacionesService } from './p6-notificaciones.service';

@Global()
@Module({
  providers: [P6NotificacionesService],
  exports: [P6NotificacionesService],
})
export class P6NotificacionesModule {}
