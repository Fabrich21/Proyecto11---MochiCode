import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogTables01 implements MigrationInterface {
  name = 'CreateCatalogTables01';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // SISTEMAS
    await queryRunner.query(`
      CREATE TABLE "sistemas" (
        "sistema_id" VARCHAR(50) NOT NULL,
        "nombre"     VARCHAR(255) NOT NULL,
        "descripcion" TEXT,
        CONSTRAINT "PK_sistemas" PRIMARY KEY ("sistema_id")
      )
    `);

    // POLITICAS_SLA
    await queryRunner.query(`
      CREATE TABLE "politicas_sla" (
        "id"                               UUID NOT NULL DEFAULT gen_random_uuid(),
        "nombre"                            VARCHAR(255) NOT NULL,
        "tiempo_maximo_resolucion_minutos" INTEGER NOT NULL,
        CONSTRAINT "PK_politicas_sla" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "politicas_sla"`);
    await queryRunner.query(`DROP TABLE "sistemas"`);
  }
}
