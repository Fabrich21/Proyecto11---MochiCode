import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Reflector } from '@nestjs/core';

/**
 * SCRUM-63: Guard Híbrido para Endpoints de Ingesta
 * Permite pasar si la petición trae la x-api-key correcta (Servidores)
 * O si trae un JWT válido (Humanos desde el Dashboard)
 */
@Injectable()
export class HybridAuthGuard extends JwtAuthGuard {
  constructor(reflector: Reflector, private configService: ConfigService) {
    super(reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // 1. Intentar validar API Key (Zero Trust)
    const apiKeyHeader = request.headers['x-api-key'];
    if (apiKeyHeader) {
      const { sistema_id } = request.body;
      if (!sistema_id) {
         throw new UnauthorizedException('Debe especificar un sistema_id en el payload');
      }

      // Normalizamos: ej. "P01", "P08"
      let normalizedId = String(sistema_id).toUpperCase();
      const match = normalizedId.match(/^P(\d+)$/);
      if (match) {
        normalizedId = `P${match[1].padStart(2, '0')}`;
      }

      const expectedKey = this.configService.get<string>(`API_KEY_${normalizedId}`);

      if (!expectedKey || apiKeyHeader !== expectedKey) {
        throw new UnauthorizedException(`Credenciales inválidas para el sistema: ${sistema_id}`);
      }

      // Le inyectamos un usuario falso para que el resto del sistema no falle
      request.user = {
        userId: '00000000-0000-0000-0000-000000000001',
        username: 'sistema_externo',
        roles: ['api_client']
      };
      return true;
    }

    // 2. Si no hay API Key o es inválida, intentar validar JWT (Humanos)
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // canActivate de JwtAuthGuard verifica la firma y expiración
        return (await super.canActivate(context)) as boolean;
      } catch (err) {
        throw new UnauthorizedException('Token JWT inválido o expirado');
      }
    }

    throw new UnauthorizedException('Debe proveer x-api-key o un token Bearer válido');
  }
}
