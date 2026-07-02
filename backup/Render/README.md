# Backup Render — dependencias de despliegue

Copia de los archivos de dependencias tal como están configurados para **Render** (Linux).

## Archivos respaldados

- `package.json` (raíz del monorepo)
- `package-lock.json` (raíz)
- `apps/frontend/package.json` — incluye `@tailwindcss/oxide-linux-x64-gnu` y `lightningcss-linux-x64-gnu`
- `apps/backend/package.json`
- `packages/shared-types/package.json`

## Restaurar antes de merge a main

Desde la raíz del repositorio:

```powershell
Copy-Item backup\Render\package.json package.json
Copy-Item backup\Render\package-lock.json package-lock.json
Copy-Item backup\Render\apps\frontend\package.json apps\frontend\package.json
Copy-Item backup\Render\apps\backend\package.json apps\backend\package.json
Copy-Item backup\Render\packages\shared-types\package.json packages\shared-types\package.json
npm install
```
