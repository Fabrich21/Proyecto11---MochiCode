import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateComentariosTable1780000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'comentarios',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'incidente_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'usuario_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'contenido',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'creado_en',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['incidente_id'],
            referencedTableName: 'incidentes',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            columnNames: ['incidente_id'],
            name: 'idx_comentarios_incidente_id',
          },
          {
            columnNames: ['usuario_id'],
            name: 'idx_comentarios_usuario_id',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('comentarios', true);
  }
}
