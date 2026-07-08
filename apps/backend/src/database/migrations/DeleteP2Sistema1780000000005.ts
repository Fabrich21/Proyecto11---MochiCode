import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeleteP2Sistema1780000000005 implements MigrationInterface {
  name = 'DeleteP2Sistema1780000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eliminar P2 de la tabla sistemas
    await queryRunner.query(`
      DELETE FROM "sistemas" 
      WHERE "sistema_id" = 'P2'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restaurar P2 en caso de rollback
    await queryRunner.query(`
      INSERT INTO "sistemas" ("sistema_id", "nombre", "descripcion")
      VALUES ('P2', 'Logística', 'Proyecto 2 - Sistema de Logística')
      ON CONFLICT ("sistema_id") DO NOTHING
    `);
  }
}
