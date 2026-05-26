import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Incidente } from './incidente.entity';

@Entity('auditoria')
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'incidente_id', type: 'uuid' })
  incidenteId!: string;

  @Column({ name: 'accion_por_usuario_id', type: 'uuid' })
  accionPorUsuarioId!: string;

  @Column({ name: 'descripcion_accion', type: 'text' })
  descripcionAccion!: string;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamptz' })
  creadoEn!: Date;

  @ManyToOne(() => Incidente)
  @JoinColumn({ name: 'incidente_id' })
  incidente!: Incidente;
}
