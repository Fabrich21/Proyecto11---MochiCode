import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Incidente } from './incidente.entity';

@Entity('acciones_playbook')
export class AccionPlaybook {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'incidente_id', type: 'uuid' })
  incidenteId!: string;

  @Column({ name: 'tipo_accion', type: 'varchar', length: 100 })
  tipoAccion!: string;

  @Column({ name: 'ejecutado_por_usuario_id', type: 'uuid' })
  ejecutadoPorUsuarioId!: string;

  @CreateDateColumn({ name: 'ejecutado_en', type: 'timestamptz' })
  ejecutadoEn!: Date;

  @ManyToOne(() => Incidente)
  @JoinColumn({ name: 'incidente_id' })
  incidente!: Incidente;
}
