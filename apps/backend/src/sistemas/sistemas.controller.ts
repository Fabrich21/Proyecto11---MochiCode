import { Controller, Get } from '@nestjs/common';
import { SistemasService } from './sistemas.service';

@Controller('sistemas')
export class SistemasController {
  constructor(private readonly sistemasService: SistemasService) {}

  @Get()
  findAll() {
    return this.sistemasService.findAll();
  }
}