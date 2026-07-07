import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly clientId: string;

  constructor(private configService: ConfigService) {
    const jwksUri = configService.get<string>('P12_JWKS_URI');
    const issuer = configService.get<string>('P12_ISSUER');
    const clientId = configService.get<string>('P12_CLIENT_ID', 'app-11');

    if (!jwksUri || !issuer) {
      throw new Error('Faltan variables de entorno P12_JWKS_URI o P12_ISSUER para configurar JwtStrategy');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: jwksUri,
      }),
      issuer: issuer,
      algorithms: ['RS256'],
    });

    this.clientId = clientId;
  }

  async validate(payload: any) {
    // Si la firma y la expiración son válidas, Passport llama a este método.
    // Aquí extraemos la información clave del token para inyectarla en `req.user`
    
    // El payload puede o no tener roles dependiendo de la configuración de Keycloak,
    // así que extraemos defensivamente.
    const realmRoles = payload.realm_access?.roles || [];
    const resourceRoles = payload.resource_access?.[this.clientId]?.roles || [];
    
    // Juntamos todos los roles funcionales para hacer más fácil la validación
    const allRoles = [...realmRoles, ...resourceRoles];

    return {
      userId: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      roles: allRoles,
      realmRoles,
      resourceRoles,
      clientId: this.clientId
    };
  }
}
