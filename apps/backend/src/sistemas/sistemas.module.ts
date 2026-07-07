import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sistema } from '../database/entities/sistema.entity';
import { SistemasController } from './sistemas.controller';
import { SistemasService } from './sistemas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sistema])],
  controllers: [SistemasController],
  providers: [SistemasService],
})
export class SistemasModule {}