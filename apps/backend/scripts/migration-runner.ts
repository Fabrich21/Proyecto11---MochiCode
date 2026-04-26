/**
 * Script para ejecutar/revertir migraciones sin depender del CLI de TypeORM.
 * Uso:
 *   node -r ts-node/register scripts/migration-runner.ts run
 *   node -r ts-node/register scripts/migration-runner.ts revert
 */
import { AppDataSource } from '../src/database/data-source';

const command = process.argv[2];

async function main() {
  await AppDataSource.initialize();
  console.log('Conexión establecida con la base de datos.');

  if (command === 'run') {
    const migrations = await AppDataSource.runMigrations({ transaction: 'each' });
    if (migrations.length === 0) {
      console.log('No hay migraciones pendientes.');
    } else {
      migrations.forEach((m) => console.log(`✓ Ejecutada: ${m.name}`));
    }
  } else if (command === 'revert') {
    await AppDataSource.undoLastMigration({ transaction: 'each' });
    console.log('Última migración revertida.');
  } else {
    console.error('Uso: migration-runner.ts run | revert');
    process.exit(1);
  }

  await AppDataSource.destroy();
  console.log('Conexión cerrada.');
}

main().catch((err) => {
  console.error('Error en migraciones:', err);
  process.exit(1);
});
