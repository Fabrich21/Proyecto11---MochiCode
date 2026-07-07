import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Sistema')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check de la API y servicios base' })
  @ApiOkResponse({
    description: 'Estado de salud del servicio',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-07-07T15:00:00.000Z',
        services: {
          api: 'up',
          redis: 'up',
        },
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
