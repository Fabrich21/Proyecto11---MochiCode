import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ZeroTrustGuard } from './zero-trust.guard';

describe('ZeroTrustGuard', () => {
  let guard: ZeroTrustGuard;

  const buildContext = (
    apiKey: string | undefined,
    sistema_id: string | undefined,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: apiKey ? { 'x-api-key': apiKey } : {},
          body: { sistema_id },
        }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    guard = new ZeroTrustGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate()', () => {
    it('should return true when P1 sends valid api key', () => {
      // Arrange
      const ctx = buildContext('auth_p1_secret', 'P1');
      // Act & Assert
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should return true when P2 sends valid api key', () => {
      const ctx = buildContext('auth_p2_secret', 'P2');
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should return true when P8 sends valid api key', () => {
      const ctx = buildContext('auth_p8_secret', 'P8');
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should throw UnauthorizedException when x-api-key header is missing', () => {
      // Arrange
      const ctx = buildContext(undefined, 'P1');
      // Act & Assert
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(ctx)).toThrow(
        'No se proporcionó API Key (Zero Trust)',
      );
    });

    it('should throw UnauthorizedException when sistema_id is not registered', () => {
      // Arrange
      const ctx = buildContext('any-key', 'P99');
      // Act & Assert
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(ctx)).toThrow('P99');
    });

    it('should throw UnauthorizedException when api key does not match sistema_id', () => {
      // Arrange
      const ctx = buildContext('wrong-key', 'P1');
      // Act & Assert
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(ctx)).toThrow(
        'Credenciales inválidas para el sistema: P1',
      );
    });

    it('should throw UnauthorizedException when sistema_id is missing from body', () => {
      // Arrange
      const ctx = buildContext('auth_p1_secret', undefined);
      // Act & Assert
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when P1 key is used for P2', () => {
      // Arrange — cross-system key reuse
      const ctx = buildContext('auth_p1_secret', 'P2');
      // Act & Assert
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });
});
