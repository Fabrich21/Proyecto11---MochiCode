import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PoliticaSla } from './politica-sla.entity';

@Entity('reglas_escalamiento')
export class ReglaEscalamiento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'politica_sla_id', type: 'uuid' })
  politicaSlaId!: string;

  @Column({ name: 'tiempo_activacion_minutos', type: 'integer' })
  tiempoActivacionMinutos!: number;

  @Column({ name: 'notificar_a_usuario_id', type: 'uuid' })
  notificarAUsuarioId!: string;

  @ManyToOne(() => PoliticaSla)
  @JoinColumn({ name: 'politica_sla_id' })
  politicaSla!: PoliticaSla;
}
