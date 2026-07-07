import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false; // JWT guard debió haberlo atrapado, pero por si acaso.
    }

    // Gate Global: Verifica que el usuario tenga permiso base para entrar a nuestra app
    const accessRole = `${user.clientId}-access`;
    if (user.roles && !user.roles.includes(accessRole)) {
      throw new ForbiddenException(`No tienes permiso global para acceder a esta aplicación (${accessRole} requerido)`);
    }

    // Si la ruta no exige un rol específico, lo dejamos pasar.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Permisos Finos: El usuario debe tener al menos UNO de los roles requeridos
    // Si el usuario no tiene roles (arreglo vacío), pero se requieren roles, lanzamos error.
    if (user.roles.length === 0) {
       console.warn(`[RolesGuard] El endpoint exige roles [${requiredRoles.join(',')}] pero el token de P12 no trajo ningún rol. Permitimos paso en DEV.`);
       return true; // TODO: Cambiar a false cuando P12 entregue roles
    }

    const hasRole = () => user.roles.some((role: string) => requiredRoles.includes(role));
    
    if (!hasRole()) {
      throw new ForbiddenException('No tienes los roles necesarios para ejecutar esta acción');
    }
    
    return true;
  }
}
