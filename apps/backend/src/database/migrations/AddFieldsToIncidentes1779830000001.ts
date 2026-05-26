import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFieldsToIncidentes1779830000001 implements MigrationInterface {
  name = 'AddFieldsToIncidentes1779830000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incidentes"
      ADD COLUMN "asignado_a_usuario_id" UUID,
      ADD COLUMN "prioridad" VARCHAR(50) DEFAULT 'MEDIA',
      ADD COLUMN "fecha_resolucion" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incidentes"
      DROP COLUMN "fecha_resolucion",
      DROP COLUMN "prioridad",
      DROP COLUMN "asignado_a_usuario_id"
    `);
  }
}
