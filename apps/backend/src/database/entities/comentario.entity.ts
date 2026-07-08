import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Incidente } from './incidente.entity';

/**
 * Entidad que mapea la tabla "comentarios".
 * Almacena comunicaciones internas sobre incidentes.
 * Soporta menciones a usuarios (@usuario) y timestamps de creación.
 */
@Entity('comentarios')
export class Comentario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'incidente_id', type: 'uuid' })
  incidenteId!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @Column({ type: 'text' })
  contenido!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @ManyToOne(() => Incidente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidente_id' })
  incidente!: Incidente;
}
