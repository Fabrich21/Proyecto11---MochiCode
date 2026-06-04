import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Incidente } from './incidente.entity';
import { Sistema } from './sistema.entity';

@Entity('eventos_alerta')
export class EventoAlerta {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id!: string;

  @PrimaryColumn({ name: 'creado_en', type: 'timestamptz', default: () => 'now()' })
  creadoEn!: Date;

  @Column({ type: 'jsonb', default: {} })
  payload!: any;

  @Column({ name: 'sistema_id', type: 'varchar', length: 50 })
  sistemaId!: string;

  @Column({ name: 'incidente_id', type: 'uuid', nullable: true })
  incidenteId?: string;

  @ManyToOne(() => Sistema)
  @JoinColumn({ name: 'sistema_id' })
  sistema!: Sistema;

  @ManyToOne(() => Incidente)
  @JoinColumn({ name: 'incidente_id' })
  incidente?: Incidente;
}
