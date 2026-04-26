import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIncidentsTable1745634002000 implements MigrationInterface {
  name = 'CreateIncidentsTable1745634002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "incidente_estado_enum" AS ENUM ('ABIERTO', 'EN_PROGRESO', 'CERRADO')
    `);

    await queryRunner.query(`
      CREATE TABLE "incidentes" (
        "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
        "titulo"              VARCHAR(255) NOT NULL,
        "descripcion"         TEXT,
        "estado"              "incidente_estado_enum" NOT NULL DEFAULT 'ABIERTO',
        "sistema_id"          VARCHAR(50) NOT NULL,
        "creador_usuario_id"  UUID NOT NULL,
        "politica_sla_id"     UUID NOT NULL,
        "creado_en"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_incidentes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_incidentes_sistemas"
          FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("sistema_id") ON DELETE RESTRICT,
        CONSTRAINT "FK_incidentes_politicas_sla"
          FOREIGN KEY ("politica_sla_id") REFERENCES "politicas_sla"("id") ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "incidentes"`);
    await queryRunner.query(`DROP TYPE "incidente_estado_enum"`);
  }
}
