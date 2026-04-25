import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditAndSupportTables06 implements MigrationInterface {
  name = 'CreateAuditAndSupportTables06';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // AUDITORIA
    await queryRunner.query(`
      CREATE TABLE "auditoria" (
        "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
        "incidente_id"         UUID NOT NULL,
        "accion_por_usuario_id" UUID NOT NULL,
        "descripcion_accion"   TEXT NOT NULL,
        "creado_en"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auditoria" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auditoria_incidentes"
          FOREIGN KEY ("incidente_id") REFERENCES "incidentes"("id") ON DELETE CASCADE
      )
    `);

    // EVIDENCIAS
    await queryRunner.query(`
      CREATE TABLE "evidencias" (
        "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
        "incidente_id" UUID NOT NULL,
        "url_archivo"  TEXT NOT NULL,
        "descripcion"  TEXT,
        "subido_en"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_evidencias" PRIMARY KEY ("id"),
        CONSTRAINT "FK_evidencias_incidentes"
          FOREIGN KEY ("incidente_id") REFERENCES "incidentes"("id") ON DELETE CASCADE
      )
    `);

    // ACCIONES_PLAYBOOK
    await queryRunner.query(`
      CREATE TABLE "acciones_playbook" (
        "id"                     UUID NOT NULL DEFAULT gen_random_uuid(),
        "incidente_id"           UUID NOT NULL,
        "tipo_accion"            VARCHAR(100) NOT NULL,
        "ejecutado_por_usuario_id" UUID NOT NULL,
        "ejecutado_en"           TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_acciones_playbook" PRIMARY KEY ("id"),
        CONSTRAINT "FK_acciones_playbook_incidentes"
          FOREIGN KEY ("incidente_id") REFERENCES "incidentes"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "acciones_playbook"`);
    await queryRunner.query(`DROP TABLE "evidencias"`);
    await queryRunner.query(`DROP TABLE "auditoria"`);
  }
}
