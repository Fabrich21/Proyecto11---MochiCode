-- =============================================================================
-- INIT SCRIPT: Habilitar TimescaleDB como extensión de PostgreSQL
-- Se ejecuta automáticamente al crear el contenedor por primera vez.
-- =============================================================================

-- Activar la extensión TimescaleDB en la base de datos del proyecto
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Verificar instalación (el resultado queda en los logs del contenedor)
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'timescaledb';
