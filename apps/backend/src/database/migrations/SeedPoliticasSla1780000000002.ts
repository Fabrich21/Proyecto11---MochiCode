import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedPoliticasSla1780000000002 implements MigrationInterface {
  name = 'SeedPoliticasSla1780000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "politicas_sla" ("id", "nombre", "tiempo_maximo_resolucion_minutos")
      VALUES 
        (gen_random_uuid(), 'ALTA', 60),      -- 1 hora
        (gen_random_uuid(), 'MEDIA', 240),    -- 4 horas
        (gen_random_uuid(), 'BAJA', 1440)     -- 24 horas
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "politicas_sla" WHERE "nombre" IN ('ALTA', 'MEDIA', 'BAJA');
    `);
  }
}
