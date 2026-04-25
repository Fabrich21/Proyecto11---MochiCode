import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAlertEventsHypertable05 implements MigrationInterface {
  name = 'CreateAlertEventsHypertable05';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "eventos_alerta" (
        "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
        "creado_en"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "payload"      JSONB NOT NULL DEFAULT '{}',
        "sistema_id"   VARCHAR(50) NOT NULL,
        "incidente_id" UUID,
        CONSTRAINT "PK_eventos_alerta" PRIMARY KEY ("id", "creado_en"),
        CONSTRAINT "FK_eventos_alerta_sistemas"
          FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("sistema_id") ON DELETE RESTRICT,
        CONSTRAINT "FK_eventos_alerta_incidentes"
          FOREIGN KEY ("incidente_id") REFERENCES "incidentes"("id") ON DELETE SET NULL
      )
    `);

    // Convertir a Hypertable de TimescaleDB particionado por tiempo
    await queryRunner.query(`
      SELECT create_hypertable('eventos_alerta', 'creado_en')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "eventos_alerta"`);
  }
}
