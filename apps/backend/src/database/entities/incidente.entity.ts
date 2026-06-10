import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sistema } from './sistema.entity';
import { PoliticaSla } from './politica-sla.entity';

import { IncidenteEstado, IIncidente } from '@proyecto/shared-types';

/**
 * Entidad que mapea la tabla "incidentes".
 * Es el registro central del sistema: se crea automáticamente cuando el Worker
 * procesa una alerta y no puede ser eliminado (solo cambia de estado).
 */
@Entity('incidentes')
export class Incidente implements IIncidente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Título generado automáticamente por el Worker a partir del sistema_id y el timestamp
  @Column({ type: 'varchar', length: 255 })
  titulo!: string;

  // Descripción opcional: se rellena con un resumen del payload recibido
  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @Column({
    type: 'enum',
    enum: IncidenteEstado,
    // enumName indica a TypeORM que use el tipo ENUM que YA existe en PostgreSQL,
    // en lugar de intentar crear uno nuevo (evita conflictos de migración).
    enumName: 'incidente_estado_enum',
    default: IncidenteEstado.ABIERTO,
  })
  estado!: IncidenteEstado;

  // FK al sistema que originó la alerta
  @Column({ name: 'sistema_id', type: 'varchar', length: 50 })
  sistemaId!: string;

  // UUID del "creador". Para incidentes generados automáticamente por el Worker,
  // se usa un UUID centinela (SISTEMA_AUTOMATICO_UUID). Esto se reemplazará
  // por el JWT.sub de P12 cuando la integración de auth esté completa.
  @Column({ name: 'creador_usuario_id', type: 'uuid' })
  creadorUsuarioId!: string;

  @Column({ name: 'politica_sla_id', type: 'uuid' })
  politicaSlaId!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @Column({ name: 'asignado_a_usuario_id', type: 'uuid', nullable: true })
  asignadoAUsuarioId?: string;

  @Column({ type: 'varchar', length: 50, default: 'MEDIA' })
  prioridad!: string;

  @Column({ name: 'fecha_resolucion', type: 'timestamptz', nullable: true })
  fechaResolucion?: Date;

  // Relaciones para joins opcionales (lazy loading desactivado por defecto)
  @ManyToOne(() => Sistema)
  @JoinColumn({ name: 'sistema_id' })
  sistema!: Sistema;

  @ManyToOne(() => PoliticaSla)
  @JoinColumn({ name: 'politica_sla_id' })
  politicaSla!: PoliticaSla;
}
