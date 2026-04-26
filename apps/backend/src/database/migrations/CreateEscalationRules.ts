import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEscalationRules1745634003000 implements MigrationInterface {
  name = 'CreateEscalationRules1745634003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reglas_escalamiento" (
        "id"                       UUID NOT NULL DEFAULT gen_random_uuid(),
        "politica_sla_id"          UUID NOT NULL,
        "tiempo_activacion_minutos" INTEGER NOT NULL,
        "notificar_a_usuario_id"   UUID NOT NULL,
        CONSTRAINT "PK_reglas_escalamiento" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reglas_escalamiento_politicas_sla"
          FOREIGN KEY ("politica_sla_id") REFERENCES "politicas_sla"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reglas_escalamiento"`);
  }
}
