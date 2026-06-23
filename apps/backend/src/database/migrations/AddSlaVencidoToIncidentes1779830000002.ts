import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración: soporte para vencimiento de SLA.
 *
 * Cambios:
 *  1. Agrega 'VENCIDO' al enum "incidente_estado_enum"
 *     (ALTER TYPE es seguro en PostgreSQL; no requiere recrear la tabla).
 *  2. Agrega columna "sla_vencido" a "incidentes":
 *     - FLAG booleano que el SlaScheduler activa exactamente una vez por ticket.
 *     - Evita que el cron procese el mismo incidente en cada ejecución.
 *  3. Crea índice parcial para que la query del cron sea O(pocos) en lugar de O(total).
 */
export class AddSlaVencidoToIncidentes1779830000002 implements MigrationInterface {
  name = 'AddSlaVencidoToIncidentes1779830000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Extender el enum con el nuevo valor
    await queryRunner.query(`
      ALTER TYPE "incidente_estado_enum" ADD VALUE IF NOT EXISTS 'VENCIDO'
    `);

    // 2. Agregar columna flag
    await queryRunner.query(`
      ALTER TABLE "incidentes"
      ADD COLUMN IF NOT EXISTS "sla_vencido" BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // 3. Índice parcial: el cron solo escanea los tickets activos no vencidos
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_incidentes_sla_pendiente"
      ON "incidentes" ("creado_en", "politica_sla_id")
      WHERE "estado" IN ('ABIERTO', 'EN_PROGRESO') AND "sla_vencido" = FALSE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_incidentes_sla_pendiente"`);

    await queryRunner.query(`
      ALTER TABLE "incidentes" DROP COLUMN IF EXISTS "sla_vencido"
    `);

    // Nota: PostgreSQL no permite hacer DROP VALUE en un enum.
    // Para revertir el valor 'VENCIDO' habría que recrear el tipo,
    // lo cual requiere un procedimiento más complejo. Se deja documentado.
  }
}
