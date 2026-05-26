import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Incidente } from './incidente.entity';

@Entity('evidencias')
export class Evidencia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'incidente_id', type: 'uuid' })
  incidenteId!: string;

  @Column({ name: 'url_archivo', type: 'text' })
  urlArchivo!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;

  @CreateDateColumn({ name: 'subido_en', type: 'timestamptz' })
  subidoEn!: Date;

  @ManyToOne(() => Incidente)
  @JoinColumn({ name: 'incidente_id' })
  incidente!: Incidente;
}
