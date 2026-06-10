import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ZeroTrustGuard implements CanActivate {
  // Inyectamos el servicio de configuración global de NestJS
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const { sistema_id } = request.body;

    if (!apiKey) {
      throw new UnauthorizedException('No se proporcionó API Key (Zero Trust)');
    }

    if (!sistema_id) {
      throw new UnauthorizedException('Debe especificar el sistema_id en el payload');
    }

    // Construimos dinámicamente el nombre de la variable de entorno (ej: API_KEY_P08)
    const envKeyName = `API_KEY_${sistema_id.toUpperCase()}`;
    
    // Vamos a buscar esa llave al archivo .env
    const validKey = this.configService.get<string>(envKeyName);

    // Si la llave no existe en el .env, o si no coincide con la que envió el cliente, bloqueamos.
    if (!validKey || validKey !== apiKey) {
      throw new UnauthorizedException(`Credenciales inválidas para el sistema: ${sistema_id}`);
    }

    return true;
  }
}