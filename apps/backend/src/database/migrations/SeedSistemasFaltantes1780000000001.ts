import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedSistemasFaltantes1780000000001 implements MigrationInterface {
  name = 'SeedSistemasFaltantes1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "sistemas" ("sistema_id", "nombre", "descripcion")
      VALUES 
        ('P01', 'Salud domiciliaria', 'Proyecto 1'),
        ('P03', 'Pedidos omnicanal', 'Proyecto 3'),
        ('P05', 'Inventario distribuido', 'Proyecto 5'),
        ('P08', 'IoT para activos', 'Proyecto 8'),
        ('P10', 'Suscripciones y contratos', 'Proyecto 10'),
        ('P11', 'Incidentes operacionales', 'Proyecto 11 (Nosotros)')
      ON CONFLICT ("sistema_id") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "sistemas" 
      WHERE "sistema_id" IN ('P01', 'P03', 'P05', 'P08', 'P10', 'P11')
    `);
  }
}
