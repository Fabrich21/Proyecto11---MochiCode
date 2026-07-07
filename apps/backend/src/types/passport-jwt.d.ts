declare module 'passport-jwt' {
  export const ExtractJwt: {
    fromAuthHeaderAsBearerToken(): (request: unknown) => string | null;
  };

  export class Strategy {
    constructor(options: unknown, verify: (...args: unknown[]) => unknown);
  }
}
