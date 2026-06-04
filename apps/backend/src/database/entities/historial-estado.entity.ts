import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Incidente } from './incidente.entity';

@Entity('historial_estados')
export class HistorialEstado {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'incidente_id', type: 'uuid' })
  incidenteId!: string;

  @Column({ name: 'estado_anterior', type: 'varchar', length: 50, nullable: true })
  estadoAnterior?: string;

  @Column({ name: 'estado_nuevo', type: 'varchar', length: 50 })
  estadoNuevo!: string;

  @Column({ name: 'cambiado_por_usuario_id', type: 'uuid' })
  cambiadoPorUsuarioId!: string;

  @PrimaryColumn({ name: 'cambiado_en', type: 'timestamptz', default: () => 'now()' })
  cambiadoEn!: Date;

  @ManyToOne(() => Incidente)
  @JoinColumn({ name: 'incidente_id' })
  incidente!: Incidente;
}
