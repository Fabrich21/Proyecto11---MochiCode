import { Global, Module, OnModuleInit, Logger } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import axiosRetry from 'axios-retry';

/**
 * Módulo global de cliente HTTP.
 * Sirve como un wrapper resiliente: cualquier servicio del backend que 
 * importe HttpService usará esta misma configuración con reintentos automáticos.
 */
@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000, // No dejaremos que una petición colgada rompa nuestro worker
      maxRedirects: 3,
    }),
  ],
  exports: [HttpModule], // Lo exportamos para que todos tengan acceso a HttpService
})
export class HttpClientModule implements OnModuleInit {
  private readonly logger = new Logger(HttpClientModule.name);

  constructor(private readonly httpService: HttpService) {}

  onModuleInit() {
    // Tomamos la instancia interna de Axios que maneja NestJS
    const axiosInstance = this.httpService.axiosRef;

    // Le inyectamos la lógica de tolerancia a fallos
    axiosRetry(axiosInstance, {
      retries: 3, // 3 intentos antes de rendirnos definitivamente
      
      // Retardo exponencial: espera 1s, luego 2s, luego 4s...
      retryDelay: (retryCount) => {
        this.logger.warn(`Intento HTTP fallido. Reintentando por ${retryCount}ª vez...`);
        return axiosRetry.exponentialDelay(retryCount);
      },

      // ¿Cuándo reintentamos? Cuando se caiga la red, haya un 5xx o nos bloqueen por Rate Limit (429)
      retryCondition: (error) => {
        const isNetworkOr5xxError = axiosRetry.isNetworkOrIdempotentRequestError(error);
        const statusCode = error.response?.status;
        const isRateLimit = statusCode === 429;
        
        if (isNetworkOr5xxError || isRateLimit) {
          return true;
        }
        
        // Si es un 400 (Bad Request) o 401 (Auth), no tiene sentido reintentar
        return false;
      },
    });
  }
}
