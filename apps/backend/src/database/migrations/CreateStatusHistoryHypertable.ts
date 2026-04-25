import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStatusHistoryHypertable04 implements MigrationInterface {
  name = 'CreateStatusHistoryHypertable04';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "historial_estados" (
        "id"                      UUID NOT NULL DEFAULT gen_random_uuid(),
        "incidente_id"            UUID NOT NULL,
        "estado_anterior"         VARCHAR(50),
        "estado_nuevo"            VARCHAR(50) NOT NULL,
        "cambiado_por_usuario_id" UUID NOT NULL,
        "cambiado_en"             TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_historial_estados" PRIMARY KEY ("id", "cambiado_en"),
        CONSTRAINT "FK_historial_estados_incidentes"
          FOREIGN KEY ("incidente_id") REFERENCES "incidentes"("id") ON DELETE CASCADE
      )
    `);

    // Convertir a Hypertable de TimescaleDB particionado por tiempo
    await queryRunner.query(`
      SELECT create_hypertable('historial_estados', 'cambiado_en')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "historial_estados"`);
  }
}
