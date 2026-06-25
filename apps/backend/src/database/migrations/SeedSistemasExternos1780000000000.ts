import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSistemasExternos1780000000000 implements MigrationInterface {
  name = 'SeedSistemasExternos1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "sistemas" ("sistema_id", "nombre", "descripcion")
      VALUES 
        ('P04', 'Pagos', 'Proyecto 4 - Pasarela de Pagos'),
        ('P06', 'Notificaciones', 'Proyecto 6 - Servicio de Notificaciones'),
        ('P07', 'CRM', 'Proyecto 7 - Gestión de Clientes'),
        ('P09', 'Inventario', 'Proyecto 9 - Gestión de Stock'),
        ('P12', 'SSO', 'Proyecto 12 - Autenticación y Autorización')
      ON CONFLICT ("sistema_id") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "sistemas" 
      WHERE "sistema_id" IN ('P04', 'P06', 'P07', 'P09', 'P12')
    `);
  }
}
