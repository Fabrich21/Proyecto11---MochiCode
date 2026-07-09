import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class P06ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.query.api_key ?? request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new HttpException(
        { ok: false, message: 'api_key es requerida' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const validKey =
      this.configService.get<string>('INCIDENTES_API_KEY') ??
      this.configService.get<string>('API_KEY_P07');

    if (!validKey) {
      throw new HttpException(
        { ok: false, message: 'API key inválida' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const validKeyBuffer = Buffer.from(validKey);
    const apiKeyBuffer = Buffer.from(apiKey);

    if (
      validKeyBuffer.length !== apiKeyBuffer.length ||
      !crypto.timingSafeEqual(validKeyBuffer, apiKeyBuffer)
    ) {
      throw new HttpException(
        { ok: false, message: 'API key inválida' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return true;
  }
}