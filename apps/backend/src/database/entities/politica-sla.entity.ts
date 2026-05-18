import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Entidad que mapea la tabla "politicas_sla".
 * Define el tiempo máximo en minutos que tiene el equipo para resolver un incidente
 * según su categoría (ej: P1 Crítico = 60 min, P3 Normal = 480 min).
 */
@Entity('politicas_sla')
export class PoliticaSla {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  nombre!: string;

  // Tiempo límite de resolución expresado en minutos
  @Column({ name: 'tiempo_maximo_resolucion_minutos', type: 'integer' })
  tiempoMaximoResolucionMinutos!: number;
}
