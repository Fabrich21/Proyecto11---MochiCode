import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmTicketId1783550000000 implements MigrationInterface {
  name = 'AddCrmTicketId1783550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "incidentes" ADD "crm_ticket_id" character varying(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "incidentes" DROP COLUMN "crm_ticket_id"`);
  }
}
