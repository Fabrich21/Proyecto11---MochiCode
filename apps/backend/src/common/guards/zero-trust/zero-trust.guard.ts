import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ZeroTrustGuard implements CanActivate {
  // En producción, usa variables de entorno (.env)
  private readonly validKeys: Record<string, string> = {
    'P1': 'auth_p1_secret',
    'P2': 'auth_p2_secret',
    'P8': 'auth_p8_secret',
  };

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const { sistema_id } = request.body;

    if (!apiKey) {
      throw new UnauthorizedException('No se proporcionó API Key (Zero Trust)');
    }

    if (!sistema_id || this.validKeys[sistema_id] !== apiKey) {
      throw new UnauthorizedException(`Credenciales inválidas para el sistema: ${sistema_id}`);
    }

    return true;
  }
}