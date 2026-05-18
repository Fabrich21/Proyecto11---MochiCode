import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Entidad que mapea la tabla "sistemas".
 * Representa cada proyecto externo registrado que puede enviar alertas
 * (ej: P1-Salud, P2-Logística, P8-IoT).
 */
@Entity('sistemas')
export class Sistema {
  // Clave primaria de tipo VARCHAR (no UUID), identificador corto como "P1", "P2", etc.
  @PrimaryColumn({ name: 'sistema_id', type: 'varchar', length: 50 })
  sistemaId!: string;

  @Column({ type: 'varchar', length: 255 })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion?: string;
}
