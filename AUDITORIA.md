# Auditoría Técnica — Proyecto11 MochiCode

> Revisión de solo lectura realizada el 2026-06-11 bajo el rol **Project Reviewer**
> (arquitecto + ingeniero principal + auditor OWASP + DevOps + QA lead).
> No se modificó ningún archivo de código durante la auditoría.

---

## Executive Summary

`Proyecto11---MochiCode` es un monorepo NestJS + Next.js + TimescaleDB/Redis bien estructurado a nivel de capas (ingesta asíncrona → cola → worker → persistencia transaccional → API de lectura). El patrón de ingesta con BullMQ, las transacciones atómicas con `QueryRunner` y el `ZeroTrustGuard` con `timingSafeEqual` muestran madurez. Sin embargo, **el proyecto NO está listo para producción**: el módulo de lectura/escritura de incidentes (`/incidentes`) está **completamente sin autenticación**, la deduplicación de incidentes tiene una **condición de carrera** sin bloqueo ni constraint único, **faltan todos los índices** sobre las columnas que se filtran y ordenan, y el **proxy del frontend apunta a rutas que no existen en el backend** (integración rota). Hay además secretos de aspecto real comprometidos en `.env.example` y scripts.

---

## Top Critical Findings

1. 🔴 **Endpoints `/incidentes` sin guard de autenticación** — cualquiera lista y modifica incidentes. (`apps/backend/src/incidentes/incidentes.controller.ts`)
2. 🔴 **`usuarioId` aceptado desde el body sin verificación** — suplantación de actor en auditoría. (`apps/backend/src/incidentes/dto/update-estado-incidente.dto.ts`)
3. 🟠 **Condición de carrera en deduplicación** — alertas concurrentes del mismo sistema crean tickets duplicados. (`apps/backend/src/worker/worker.service.ts`)
4. 🟠 **Faltan índices** en `incidentes.estado`, `sistema_id`, `creado_en` — full scans en filtros, paginación y dedup. (`apps/backend/src/database/migrations/CreateIncidentsTable.ts`)
5. 🟠 **Proxy del frontend con rutas inexistentes** — llama `/api/incidents` e `/ingestion/alertas`; el backend expone `/api/v1/incidentes` y `/api/v1/alertas`. (`apps/frontend/src/app/api/incidents/route.ts`)
6. 🟠 **Proxy de ingesta no reenvía `x-api-key`** — toda ingesta vía frontend falla el Zero Trust. (`apps/frontend/src/app/api/ingestion/alertas/route.ts`)
7. 🟡 **Secretos de aspecto real en repo** — `auth_p08_secret` en `.env.example` y `package.json`. (`package.json`)
8. 🟡 **`:id` sin validación UUID** — `Patch :id/estado` puede provocar 500 con UUID malformado. (`apps/backend/src/incidentes/incidentes.controller.ts`)
9. 🟡 **Política SLA elegida arbitrariamente** (la más restrictiva) ignorando criticidad del payload. (`apps/backend/src/worker/worker.service.ts`)
10. 🔵 **Inconsistencia de persistencia** del historial: raw SQL en worker vs `repository.save` en incidentes. (`apps/backend/src/worker/worker.service.ts`)

---

## Severity Levels

| Nivel | Criterio |
|-------|----------|
| 🔴 Critical | Explotable directamente, pérdida de datos, compromiso total del sistema |
| 🟠 High | Riesgo de seguridad serio o fallo de producción probable |
| 🟡 Medium | Deuda técnica significativa, fallo bajo condiciones específicas |
| 🔵 Low | Mejora de calidad, convención, optimización menor |

---

## Detailed Findings

### [🔴 Critical] Módulo de incidentes sin autenticación
- **Categoría**: Seguridad (OWASP A01 — Broken Access Control)
- **Ubicación**: `apps/backend/src/incidentes/incidentes.controller.ts` → `IncidentesController`
- **Descripción**: Ni el controlador ni sus rutas tienen `@UseGuards`. El único guard global es `ThrottlerGuard` (rate limit), que no autentica. Cualquier cliente anónimo puede `GET /api/v1/incidentes` (exfiltración de todos los incidentes y payloads) y `PATCH /api/v1/incidentes/:id/estado` (cerrar/reabrir incidentes ajenos). El `ZeroTrustGuard` solo protege la ingesta.
- **Evidencia**:
  ```ts
  @Controller('incidentes')
  export class IncidentesController {
    @Get() findAll(@Query() query: GetIncidentesDto) { ... }
    @Patch(':id/estado') cambiarEstado(...) { ... }  // sin @UseGuards
  }
  ```
- **Fix recomendado**: aplicar un guard de autenticación (JWT de P12) a nivel de controlador y derivar el actor del token, no del body. Mientras tanto, proteger con `@UseGuards(ZeroTrustGuard)` o un guard de sesión.

### [🔴 Critical] Actor de auditoría provisto por el cliente
- **Categoría**: Seguridad (A01 / repudio)
- **Ubicación**: `apps/backend/src/incidentes/dto/update-estado-incidente.dto.ts`
- **Descripción**: `usuarioId` se acepta del body y se escribe en `historial_estados.cambiado_por_usuario_id`. Un atacante puede atribuir cambios a cualquier usuario, rompiendo la trazabilidad. El propio TODO lo admite.
- **Evidencia**:
  ```ts
  // TODO: Esto debería extraerse del token JWT en el request...
  @IsUUID() @IsNotEmpty() usuarioId!: string;
  ```
- **Fix recomendado**: eliminar `usuarioId` del DTO y tomar `req.user.sub` del token verificado.

### [🟠 High] Condición de carrera en la deduplicación de incidentes
- **Categoría**: BD / Concurrencia
- **Ubicación**: `apps/backend/src/worker/worker.service.ts` → `procesarAlerta`
- **Descripción**: La dedup hace `findOne(... estado IN [ABIERTO, EN_PROGRESO])` y, si no encuentra, crea el ticket. Con BullMQ procesando varios jobs en paralelo, dos alertas simultáneas del mismo `sistema_id` pueden no ver el ticket del otro y crear **dos incidentes activos** para el mismo sistema. No hay `SELECT ... FOR UPDATE` ni constraint único parcial.
- **Evidencia**:
  ```ts
  const incidenteActivo = await incidenteRepo.findOne({
    where: { sistemaId: dto.sistema_id, estado: In([ABIERTO, EN_PROGRESO]) },
    order: { creadoEn: 'DESC' },
  });
  // ... if (!incidenteActivo) { crear nuevo }
  ```
- **Fix recomendado**: usar bloqueo pesimista (`setLock('pessimistic_write')` sobre el sistema) o un índice único parcial `CREATE UNIQUE INDEX ... ON incidentes (sistema_id) WHERE estado IN ('ABIERTO','EN_PROGRESO')` y manejar la violación. Alternativamente, limitar concurrencia del worker por `sistema_id`.

### [🟠 High] Ausencia total de índices en `incidentes`
- **Categoría**: BD / Rendimiento
- **Ubicación**: `apps/backend/src/database/migrations/CreateIncidentsTable.ts` (sin índices en ninguna migración — verificado)
- **Descripción**: `findAll` filtra por `estado` y `sistemaId` y ordena por `creadoEn`; el worker filtra por `sistemaId + estado`. Sin índices, todas son secuenciales. A escala (la carga k6 simula 50 VUs sostenidos) esto degrada latencia y bloquea el umbral `p(95)<500ms`.
- **Evidencia**: `grep` de `CREATE INDEX` en `migrations/` → sin coincidencias.
- **Fix recomendado**: migración con `CREATE INDEX idx_incidentes_estado_sistema ON incidentes (estado, sistema_id)` y `CREATE INDEX idx_incidentes_creado_en ON incidentes (creado_en DESC)`.

### [🟠 High] Proxy del frontend apunta a rutas inexistentes
- **Categoría**: API / Integración
- **Ubicación**: `apps/frontend/src/app/api/incidents/route.ts`, `apps/frontend/src/app/api/incidents/[id]/route.ts`
- **Descripción**: El proxy llama `${BACKEND_URL}/api/incidents` y `/api/incidents/:id`, pero el backend usa prefijo global `api/v1` y controlador `incidentes` (español). Cuando `BACKEND_URL` está definido, todas las llamadas devuelven 404.
- **Evidencia**:
  ```ts
  const url = `${BACKEND_URL.replace(/\/$/, '')}/api/incidents`;  // backend real: /api/v1/incidentes
  ```
- **Fix recomendado**: alinear a `/api/v1/incidentes`. Centralizar la base path en una constante compartida para evitar divergencias.

### [🟠 High] El proxy de ingesta no reenvía la API Key
- **Categoría**: API / Integración / Seguridad
- **Ubicación**: `apps/frontend/src/app/api/ingestion/alertas/route.ts`
- **Descripción**: El proxy reenvía a `/ingestion/alertas` (ruta inexistente; la real es `/api/v1/alertas`) y solo copia `content-type`, omitiendo `x-api-key`. El `ZeroTrustGuard` rechazará con 401 toda alerta enviada vía frontend.
- **Evidencia**:
  ```ts
  const url = `${BACKEND_URL...}/ingestion/alertas`;
  headers: { 'content-type': ... }   // no x-api-key
  ```
- **Fix recomendado**: corregir la ruta a `/api/v1/alertas` y reenviar el header `x-api-key` (idealmente inyectado server-side desde env, no desde el navegador).

### [🟡 Medium] Secretos de aspecto real versionados
- **Categoría**: Seguridad (A05 — Misconfiguration / secret management)
- **Ubicación**: `.env.example`, `package.json`, `apps/backend/test/load/ingestion-stress.js`
- **Descripción**: `API_KEY_P08=auth_p08_secret` aparece en `.env.example`, y el mismo valor está quemado en el script `test:load` y como fallback en el k6. Aunque sean de ejemplo, comparten el formato/valor que probablemente se reutiliza en entornos reales, y el fallback hardcodeado contradice el comentario "NUNCA quemada en el código".
- **Fix recomendado**: usar placeholders en `.env.example` (`API_KEY_P08=<reemplazar>`), quitar la key del `package.json` (pasarla por env en CI) y eliminar el fallback en el k6.

### [🟡 Medium] `:id` sin `ParseUUIDPipe`
- **Categoría**: API / Manejo de errores
- **Ubicación**: `apps/backend/src/incidentes/incidentes.controller.ts`
- **Descripción**: `@Param('id') id: string` se usa directamente en `findOne({ where: { id } })` sobre columna `uuid`. Un `id` no-UUID provoca un error de Postgres → 500 en lugar de 400/404.
- **Fix recomendado**: `@Param('id', ParseUUIDPipe) id: string`.

### [🟡 Medium] Selección de política SLA no determinista por negocio
- **Categoría**: Arquitectura / Lógica de dominio
- **Ubicación**: `apps/backend/src/worker/worker.service.ts`
- **Descripción**: Se toma la política con menor `tiempoMaximoResolucionMinutos` ("la más restrictiva") ignorando la criticidad del payload. Todo incidente nace con el SLA más agresivo, lo que falsea métricas de cumplimiento.
- **Fix recomendado**: mapear `nivel_criticidad`/`prioridad` del payload a la política correspondiente; el propio comentario lo prevé.

### [🟡 Medium] Validación débil del payload de alerta
- **Categoría**: Seguridad / Calidad
- **Ubicación**: `apps/backend/src/ingestion/dto/create-alerta.dto.ts`
- **Descripción**: `payload` es `Record<string, any>` sin límite de profundidad/tamaño de claves; `creado_en` se valida pero **no se usa** en el worker (se ignora y se inserta `now()`), lo que puede confundir el contrato. El límite global de 1MB ayuda, pero un payload anidado grande aún consume CPU en `JSON.stringify`.
- **Fix recomendado**: documentar/usar `creado_en` o quitarlo; considerar validación de tamaño de payload y tipos esperados.

### [🔵 Low] Inconsistencia en persistencia del historial
- **Categoría**: Calidad / Mantenibilidad
- **Ubicación**: `apps/backend/src/worker/worker.service.ts` vs `apps/backend/src/incidentes/incidentes.service.ts`
- **Descripción**: El worker inserta en `historial_estados` con SQL raw alegando incompatibilidad de la PK compuesta con TypeORM, pero `incidentes.service` inserta en la misma tabla con `queryRunner.manager.save(historial)`. Dos enfoques para lo mismo aumentan el riesgo de divergencia.
- **Fix recomendado**: unificar en un único método/repositorio. La entidad tiene defaults a nivel DB, así que `save` funciona; estandarizar en él.

### [🔵 Low] `data-source.ts` con `logging: true` y request sin tipar en el guard
- **Categoría**: Calidad / DevOps
- **Ubicación**: `apps/backend/src/database/data-source.ts`, `apps/backend/src/common/guards/zero-trust/zero-trust.guard.ts`
- **Descripción**: `logging: true` global volcará todas las queries (ruidoso y potencial fuga de datos en logs en prod). El guard usa `getRequest()` sin tipar y desestructura `request.body` (acoplado a que el body parser corra antes; correcto en Express pero frágil).
- **Fix recomendado**: `logging` condicionado por `NODE_ENV`; tipar el request (`Request` de express).

---

## Technical Debt Assessment

| Ítem | Impacto |
|------|---------|
| Autenticación real (JWT P12) pendiente; actor desde body | Alto — bloquea producción |
| Sin índices en tablas de consulta principal | Alto — escalabilidad |
| Integración frontend↔backend con rutas divergentes | Alto — feature rota |
| Dedup sin bloqueo/constraint | Alto — integridad de datos |
| SLA fijo "más restrictivo" | Medio — métricas erróneas |
| Dos estilos de persistencia del historial | Bajo — mantenibilidad |
| Secretos de ejemplo realistas en repo | Medio — higiene de secretos |
| `payload: any` sin esquema | Medio — robustez |

---

## Security Assessment

| Severidad | Categoría OWASP | Archivo | Estado |
|-----------|-----------------|---------|--------|
| 🔴 | A01 Broken Access Control | `apps/backend/src/incidentes/incidentes.controller.ts` | Abierto |
| 🔴 | A01 / Repudio | `apps/backend/src/incidentes/dto/update-estado-incidente.dto.ts` | Abierto |
| 🟡 | A05 Misconfiguration (secrets) | `.env.example` | Abierto |
| 🟡 | A03 Injection (superficie payload) | `apps/backend/src/ingestion/dto/create-alerta.dto.ts` | Mitigado parcial (1MB + whitelist) |
| 🔵 | A09 Logging sensible | `apps/backend/src/database/data-source.ts` | Abierto |
| ✅ | A02 Crypto (timing-safe compare) | `apps/backend/src/common/guards/zero-trust/zero-trust.guard.ts` | Correcto |
| ✅ | DoS (body limit + rate limit) | `apps/backend/src/main.ts` | Correcto |

> Nota positiva: las queries raw usan parámetros posicionales (`$1,$2,...`), evitando inyección SQL; `synchronize: false` es correcto.

---

## Refactoring Roadmap

### 🔴 Inmediato (bloquea producción)
- Proteger `IncidentesController` con autenticación y derivar el actor del token (eliminar `usuarioId` del body).
- Corregir rutas del proxy frontend y reenvío de `x-api-key`.
- Añadir bloqueo/constraint único parcial para la deduplicación.

### 🟠 Corto plazo (próximo sprint)
- Migración de índices en `incidentes`.
- `ParseUUIDPipe` en `:id`.
- Sanear secretos de `.env.example`, `package.json` y k6.

### 🟡 Mediano plazo
- Selección dinámica de política SLA por criticidad.
- Esquema/validación del `payload`; usar o eliminar `creado_en`.
- `logging` de TypeORM condicionado al entorno.

### 🔵 Largo plazo
- Unificar persistencia del historial en un único repositorio/servicio.
- Tipar requests en guards; centralizar base path compartida frontend/backend.

---

## Production Readiness Assessment

- **Score**: 4/10
- **Riesgos principales de despliegue**:
  - API de incidentes sin autenticación (exfiltración y manipulación).
  - Integración frontend↔backend rota (rutas/headers).
  - Duplicación de incidentes bajo concurrencia.
  - Degradación de rendimiento por falta de índices.
- **Condiciones requeridas antes de producción**:
  1. Autenticación efectiva en todas las rutas de lectura/escritura.
  2. Actor de auditoría desde token, no desde body.
  3. Índices y control de concurrencia en dedup.
  4. Proxy frontend alineado y reenviando credenciales.
  5. Secretos fuera del repositorio.

---

## Final Verdict

**No** — no se aprueba este proyecto para despliegue en producción en su estado actual. La arquitectura asíncrona y la capa de ingesta son sólidas, pero existen fallos críticos de control de acceso (módulo de incidentes abierto, actor falsificable), una integración frontend rota y problemas de integridad/rendimiento de datos (dedup sin bloqueo, sin índices). Es **aprobable condicionalmente** una vez resueltos los ítems del bloque 🔴 Inmediato y 🟠 Corto plazo.

### Puntuaciones estimadas
- **Mantenibilidad**: 7/10
- **Deuda técnica**: 5/10 (10 = sin deuda)
- **Preparación para producción**: 4/10
