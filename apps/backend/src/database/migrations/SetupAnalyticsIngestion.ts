import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetupAnalyticsIngestion1745634007000 implements MigrationInterface {
  name = 'SetupAnalyticsIngestion1745634007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==========================================================================
    // ÍNDICES en eventos_alerta para queries analíticos frecuentes
    // ==========================================================================

    // Buscar eventos por sistema en ventanas de tiempo (más común en dashboards)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_eventos_alerta_sistema_tiempo"
      ON "eventos_alerta" ("sistema_id", "creado_en" DESC)
    `);

    // Agrupar eventos por incidente (para construir la línea de tiempo)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_eventos_alerta_incidente_tiempo"
      ON "eventos_alerta" ("incidente_id", "creado_en" DESC)
      WHERE "incidente_id" IS NOT NULL
    `);

    // Búsquedas sobre el payload JSONB (ej: filtrar por tipo de alerta)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_eventos_alerta_payload"
      ON "eventos_alerta" USING GIN ("payload")
    `);

    // ==========================================================================
    // ÍNDICES en historial_estados para auditoría y seguimiento de cambios
    // ==========================================================================

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_historial_estados_incidente_tiempo"
      ON "historial_estados" ("incidente_id", "cambiado_en" DESC)
    `);

    // ==========================================================================
    // COMPRESIÓN automática en TimescaleDB
    // Comprime chunks de eventos_alerta con más de 7 días (ahorro de espacio ~90%)
    // ==========================================================================

    await queryRunner.query(`
      ALTER TABLE "eventos_alerta" SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'sistema_id',
        timescaledb.compress_orderby   = 'creado_en DESC'
      )
    `);

    await queryRunner.query(`
      SELECT add_compression_policy('eventos_alerta', INTERVAL '7 days')
    `);

    // Compresión para historial_estados
    await queryRunner.query(`
      ALTER TABLE "historial_estados" SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'incidente_id',
        timescaledb.compress_orderby   = 'cambiado_en DESC'
      )
    `);

    await queryRunner.query(`
      SELECT add_compression_policy('historial_estados', INTERVAL '7 days')
    `);

    // ==========================================================================
    // RETENCIÓN de datos: elimina eventos con más de 90 días automáticamente
    // ==========================================================================

    await queryRunner.query(`
      SELECT add_retention_policy('eventos_alerta', INTERVAL '90 days')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar política de retención
    await queryRunner.query(`
      SELECT remove_retention_policy('eventos_alerta', if_exists => true)
    `);

    // Eliminar políticas de compresión
    await queryRunner.query(`
      SELECT remove_compression_policy('historial_estados', if_exists => true)
    `);

    await queryRunner.query(`
      SELECT remove_compression_policy('eventos_alerta', if_exists => true)
    `);

    // Eliminar índices
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_historial_estados_incidente_tiempo"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_eventos_alerta_payload"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_eventos_alerta_incidente_tiempo"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_eventos_alerta_sistema_tiempo"`);
  }
}
