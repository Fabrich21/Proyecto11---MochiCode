import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIncidentAuditTrigger1779830000000 implements MigrationInterface {
  name = 'CreateIncidentAuditTrigger1779830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Función que será ejecutada por el trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION log_incident_creation_fn()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO auditoria (
          incidente_id,
          accion_por_usuario_id,
          descripcion_accion,
          creado_en
        ) VALUES (
          NEW.id,
          NEW.creador_usuario_id,
          'Creación de ticket',
          NEW.creado_en
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger en la tabla 'incidentes'
    await queryRunner.query(`
      CREATE TRIGGER trg_audit_incident_creation
      AFTER INSERT ON incidentes
      FOR EACH ROW
      EXECUTE FUNCTION log_incident_creation_fn();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_audit_incident_creation ON incidentes;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS log_incident_creation_fn();`);
  }
}
