import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFechaLimiteToIncidentes1780000000001 implements MigrationInterface {
  name = 'AddFechaLimiteToIncidentes1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incidentes"
      ADD COLUMN IF NOT EXISTS "fecha_limite_resolucion" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incidentes"
      DROP COLUMN IF EXISTS "fecha_limite_resolucion"
    `);
  }
}
