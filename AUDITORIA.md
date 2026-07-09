# Auditoría Técnica — Proyecto11 MochiCode

> Revisión de solo lectura realizada el 2026-07-09 bajo el rol **Project Reviewer**
> (arquitecto + ingeniero principal + auditor OWASP + DevOps + QA lead).
> No se modificó ningún archivo de código durante la auditoría.

---

## Executive Summary

Proyecto11---MochiCode es un backend NestJS razonablemente estructurado (separación por módulos, uso de transacciones con `queryRunner`, colas BullMQ, WebSockets, migraciones TypeORM y validación con `class-validator`) que demuestra un nivel de madurez de MVP/UAT. Sin embargo, **no está listo para producción** en su estado actual. Existen fallos de seguridad graves: un **secreto de aspecto real hardcodeado como valor por defecto en el código** (`API_KEY_PROYECTO_11`), un **bypass de autorización en `RolesGuard`** que deja pasar peticiones sin roles ("Permitimos paso en DEV") sin ninguna condición de entorno, **API keys viajando por query string**, y **CORS/SSL configurados de forma insegura**. A nivel de integraciones, hay desalineaciones de contrato reales: P09 se siembra como "Inventario/Stock" pero el código lo trata como Analítica/BI; la columna `crm_ticket_id` se persiste pero la sincronización con CRM la ignora y resuelve el id desde `eventos_alerta.payload`; y el guard llamado `P06ApiKeyGuard` en realidad valida credenciales de P07. La calidad del código es aceptable pero arrastra deuda técnica en manejo de errores y acoplamiento a formatos de respuesta externos.

---

## Top Critical Findings

1. 🔴 **Secreto real hardcodeado como default** en `p6-notificaciones.service.ts` (`'6KqBvZyXpJ5mWkR8tHsUdC2eAoF3LiG7'`). — Seguridad
2. 🟠 **Bypass de autorización en `RolesGuard`**: si el token no trae roles, retorna `true` incondicionalmente (sin chequeo de `NODE_ENV`). — Seguridad
3. 🟠 **API key por query string** en `GET /incidentes/estado-ticket/:id?api_key=...` (fuga en logs/historial/proxies). — Seguridad
4. 🟠 **CORS wildcard `origin: '*'`** en el WebSocket gateway y ausencia de CORS/Helmet en `main.ts`. — Seguridad/DevOps
5. 🟠 **`rejectUnauthorized: false`** para TLS de DB y Redis en producción (MITM). — Seguridad
6. 🟠 **Confusión de credenciales/naming**: `P06ApiKeyGuard` valida `INCIDENTES_API_KEY`/`API_KEY_P07`, no P06; misma clave usada para auth inbound y llamadas outbound al CRM. — Seguridad/Arquitectura
7. 🟡 **Desalineación P09**: seed lo registra como "Inventario/Gestión de Stock" pero el código lo trata como Analítica/BI. — Arquitectura/BD
8. 🟡 **`crm_ticket_id` persistido pero ignorado**: `resolverIdTicketCrm` resuelve el id desde `eventos_alerta.payload` en lugar de la columna. — Arquitectura/BD
9. 🟡 **`.env.example` con secretos** versionado/rastreable y añadido a `.gitignore` (plantilla perdida + posible fuga en historial). — Seguridad/DevOps
10. 🟡 **`eliminarComentario` lanza `Error` genérico** para fallo de autorización → responde 500 en vez de 403. — Errores/API

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

### [🔴 Critical] Secreto de aspecto real hardcodeado como valor por defecto
- **Categoría**: Seguridad
- **Ubicación**: `apps/backend/src/p6-notificaciones/p6-notificaciones.service.ts` → constructor de `P6NotificacionesService`
- **Descripción**: La API key con la que P11 firma todas las llamadas salientes a P06 tiene un fallback embebido en el binario. Cualquiera con acceso al repo o al bundle compilado obtiene una credencial funcional. Además el mismo valor está en `.env.example`, duplicando la exposición.
- **Evidencia**:
  ```ts
  this.apiKey = this.configService.get<string>(
    'API_KEY_PROYECTO_11',
    '6KqBvZyXpJ5mWkR8tHsUdC2eAoF3LiG7',
  )!;
  ```
- **Fix recomendado**: Eliminar el default y fallar en el arranque si falta la variable. Rotar el secreto (ya está comprometido). Ejemplo:
  ```ts
  const key = this.configService.get<string>('API_KEY_PROYECTO_11');
  if (!key) throw new Error('API_KEY_PROYECTO_11 es obligatoria');
  this.apiKey = key;
  ```

### [🟠 High] Bypass de autorización en RolesGuard
- **Categoría**: Seguridad (OWASP A01: Broken Access Control)
- **Ubicación**: `apps/backend/src/auth/guards/roles.guard.ts` → `RolesGuard.canActivate`
- **Descripción**: Cuando el endpoint exige roles pero el token no trae ninguno, el guard **permite el paso** con un `TODO`. No hay comprobación de `NODE_ENV`, por lo que este bypass está activo también en producción. Un usuario autenticado sin permisos podría ejecutar acciones protegidas.
- **Evidencia**:
  ```ts
  if (user.roles.length === 0) {
     console.warn(`[RolesGuard] El endpoint exige roles [...] Permitimos paso en DEV.`);
     return true; // TODO: Cambiar a false cuando P12 entregue roles
  }
  ```
- **Fix recomendado**: Denegar por defecto (`throw new ForbiddenException(...)`). Si se necesita un modo laxo, condicionarlo explícitamente a `NODE_ENV !== 'production'` y documentarlo.

### [🟠 High] API key transmitida por query string
- **Categoría**: Seguridad (OWASP A09: Security Logging, A07: Auth Failures)
- **Ubicación**: `apps/backend/src/incidentes/incidentes.controller.ts` y `apps/backend/src/auth/guards/p06-api-key.guard.ts`
- **Descripción**: El guard acepta la credencial desde `request.query.api_key`. Las query strings quedan en logs de servidor/proxy, historiales de navegador y trazas APM. El propio Swagger documenta `?api_key=` como requerido, promoviendo el patrón inseguro.
- **Evidencia**:
  ```ts
  const apiKey = request.query.api_key ?? request.headers['x-api-key'];
  ```
  ```ts
  @ApiQuery({ name: 'api_key', required: true, description: 'API key de Incidentes entregada al CRM' })
  ```
- **Fix recomendado**: Aceptar la credencial **solo** por header `x-api-key` (o `Authorization`). Eliminar el soporte de query string y la documentación que lo sugiere.

### [🟠 High] CORS wildcard y ausencia de hardening HTTP
- **Categoría**: Seguridad (OWASP A05: Security Misconfiguration)
- **Ubicación**: `apps/backend/src/events/events.gateway.ts` y `apps/backend/src/main.ts`
- **Descripción**: El gateway de Socket.io permite `origin: '*'` (el propio comentario lo admite). En `main.ts` no se habilita CORS restringido ni `helmet`, ni un filtro global de excepciones. El WebSocket, además, no autentica conexiones entrantes (`handleConnection` no valida token).
- **Evidencia**:
  ```ts
  @WebSocketGateway({ cors: { origin: '*' } }) // En producción debería restringirse...
  ```
- **Fix recomendado**: Restringir `origin` al dominio del frontend vía env, agregar `helmet()`, `app.enableCors({ origin: [...] })` y autenticar el handshake WebSocket (verificar JWT en `handleConnection`).

### [🟠 High] TLS con validación de certificado deshabilitada en producción
- **Categoría**: Seguridad (OWASP A02/A05)
- **Ubicación**: `apps/backend/src/app.module.ts` (DB y Redis)
- **Descripción**: En producción se usa `ssl: { rejectUnauthorized: false }` para PostgreSQL y `tls: { rejectUnauthorized: false }` para Redis. Esto acepta certificados no confiables, habilitando ataques MITM sobre datos sensibles de incidentes.
- **Evidencia**:
  ```ts
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  ```
- **Fix recomendado**: Usar `rejectUnauthorized: true` con la CA correspondiente (Neon/Upstash publican sus CAs). Si el proveedor obliga a lo contrario, documentar el riesgo aceptado explícitamente.

### [🟠 High] Confusión de credenciales y naming en la integración CRM (P07)
- **Categoría**: Seguridad / Arquitectura
- **Ubicación**: `apps/backend/src/auth/guards/p06-api-key.guard.ts` y `apps/backend/src/incidentes/incidentes.service.ts`
- **Descripción**: El guard se llama `P06ApiKeyGuard` pero valida `INCIDENTES_API_KEY ?? API_KEY_P07`, y protege un endpoint que sirve al CRM (P07), no a P06. Peor aún, **la misma clave** (`INCIDENTES_API_KEY`/`API_KEY_P07`) se usa para autenticar peticiones entrantes del CRM y para firmar las llamadas salientes de P11 hacia el CRM en `obtenerEstado`. Reutilizar un secreto compartido en ambas direcciones amplifica el impacto si se filtra. El naming induce a error operativo (rotar la clave equivocada).
- **Evidencia**:
  ```ts
  // Guard "P06" valida claves de P07
  const validKey =
    this.configService.get<string>('INCIDENTES_API_KEY') ??
    this.configService.get<string>('API_KEY_P07');
  ```
  ```ts
  // Salida hacia CRM usa la MISMA clave
  const apiKey =
    this.configService.get<string>('INCIDENTES_API_KEY') ??
    this.configService.get<string>('API_KEY_P07');
  ```
- **Fix recomendado**: Renombrar el guard (p. ej. `CrmApiKeyGuard`) y separar credenciales: una clave inbound (la que P11 entrega al CRM) y otra outbound (la que el CRM entrega a P11). No compartir el mismo secreto entre direcciones.

### [🟡 Medium] Desalineación de identidad del sistema P09
- **Categoría**: Arquitectura / BD
- **Ubicación**: `apps/backend/src/database/migrations/SeedSistemasExternos1780000000000.ts` vs `apps/backend/src/ingestion/normalizer/payload-normalizer.service.ts`
- **Descripción**: El seed registra `P09` como `'Inventario'`/`'Proyecto 9 - Gestión de Stock'`, pero el normalizador mapea `P09 → normalizeP9Analitica` (Analítica/BI) y el webhook de cierre apunta a `P9_ANALITICA_URL`. Además `P05` ya es "Inventario". Hay ambigüedad real sobre qué es P09, con riesgo de enrutar eventos/normalización al dominio equivocado.
- **Evidencia**:
  ```sql
  ('P09', 'Inventario', 'Proyecto 9 - Gestión de Stock'),
  ```
  ```ts
  P9: normalizeP9Analitica,
  P09: normalizeP9Analitica,
  ```
- **Fix recomendado**: Definir la fuente de verdad para P09 (Analítica) y corregir el seed con una nueva migración: `('P09', 'Analítica', 'Proyecto 9 - Analítica/BI')`. Verificar que no haya seeds solapados con P05.

### [🟡 Medium] Columna `crm_ticket_id` persistida pero no utilizada en la sincronización
- **Categoría**: Arquitectura / BD
- **Ubicación**: `apps/backend/src/incidentes/incidentes.service.ts` y `apps/backend/src/worker/worker.service.ts`
- **Descripción**: El worker guarda `crmTicketId: normalizado.externalId` en la columna `crm_ticket_id` (migración `AddCrmTicketId1783550000000`). Sin embargo, `resolverIdTicketCrm` **ignora esa columna** y re-lee el id desde `eventos_alerta.payload`. Es lógica duplicada y frágil, y contradice el comentario del método `sincronizarEstadosDesdeCrm` que afirma "El id del incidente en P11 coincide con el id del ticket en CRM" (falso, ya que se resuelve otro id). El acceso a `eventos_alerta` (hypertable) con `findOne` ordenado por `creadoEn DESC` sobre `incidenteId` puede ser costoso sin índice.
- **Evidencia**:
  ```ts
  const posibleId =
    payload.id_ticket_interno ?? payload.id_ticket ?? payload.ticket_id ?? payload.id;
  ```
- **Fix recomendado**: Usar `incidente.crmTicketId` directamente en `resolverIdTicketCrm` (ya viene poblado por el worker), eliminando la consulta a `eventos_alerta`. Corregir el comentario contradictorio.

### [🟡 Medium] Acoplamiento frágil al formato de respuesta del CRM y N+1 de llamadas externas
- **Categoría**: Arquitectura / Errores
- **Ubicación**: `apps/backend/src/incidentes/incidentes.service.ts` → `sincronizarEstadosDesdeCrm`
- **Descripción**: La sincronización lee `respuesta?.ticket?.estado` sin validar la forma de la respuesta; si el CRM cambia el contrato, todos los incidentes se saltan en silencio (`estadoCrm` undefined → warn → continue). El bucle hace una llamada HTTP por incidente activo de forma secuencial dentro de un cron cada 5 min, sin timeout explícito ni backoff, lo que puede degradar el cron si P07 está lento o hay muchos incidentes.
- **Evidencia**:
  ```ts
  const respuesta: any = await this.obtenerEstado(idTicketCrm);
  const estadoCrm = respuesta?.ticket?.estado;
  ```
- **Fix recomendado**: Validar el contrato con un DTO/schema, definir `timeout` en la llamada HTTP, y considerar concurrencia acotada (p. ej. `Promise.allSettled` en lotes) y observabilidad de fallos agregados.

### [🟡 Medium] `eliminarComentario` responde 500 en violación de autorización
- **Categoría**: Errores / API
- **Ubicación**: `apps/backend/src/incidentes/incidentes.service.ts` → `eliminarComentario`
- **Descripción**: Cuando un usuario que no es el creador intenta borrar un comentario, se lanza un `Error` genérico de JavaScript, que NestJS traduce a HTTP 500. La semántica correcta es 403 Forbidden. Además el propio comentario admite que la lógica de admin no está implementada.
- **Evidencia**:
  ```ts
  if (comentario.usuarioId !== usuarioId) {
    throw new Error('Solo el creador del comentario puede eliminarlo');
  }
  ```
- **Fix recomendado**: Usar `throw new ForbiddenException('Solo el creador del comentario puede eliminarlo')`.

### [🟡 Medium] Webhook a P09 sin autenticación ni destino real
- **Categoría**: API / Arquitectura
- **Ubicación**: `apps/backend/src/incidentes/incidentes.service.ts` → `notificarEventoAP9`
- **Descripción**: Las notificaciones a P09 se envían con `httpService.post(this.p9AnaliticaUrl, envelope)` sin ningún header de autenticación, y el default de URL es un placeholder (`http://p9-analitica/...`). Si P09 exige API key, todas las notificaciones fallarán (aunque de forma no bloqueante, solo se auditan como fallo).
- **Evidencia**:
  ```ts
  await firstValueFrom(this.httpService.post(this.p9AnaliticaUrl, envelope));
  ```
- **Fix recomendado**: Añadir header de autenticación (p. ej. `x-api-key` con `API_KEY_P09`), validar/forzar la URL destino y considerar reintentos con cola en lugar de fire-and-forget silencioso.

### [🟡 Medium] Comparación de API key sin timing-safe en HybridAuthGuard
- **Categoría**: Seguridad
- **Ubicación**: `apps/backend/src/auth/guards/hybrid-auth.guard.ts`
- **Descripción**: A diferencia de `ZeroTrustGuard` y `P06ApiKeyGuard` (que usan `crypto.timingSafeEqual`), este guard compara con `!==`, vulnerable a timing attacks. Inconsistencia de criterio de seguridad entre guards que hacen lo mismo.
- **Evidencia**:
  ```ts
  if (!expectedKey || apiKeyHeader !== expectedKey) {
    throw new UnauthorizedException(...);
  }
  ```
- **Fix recomendado**: Unificar la validación de API keys en un helper compartido que use `timingSafeEqual`, eliminando la duplicación entre los tres guards.

### [🟡 Medium] `.env.example` con secretos, versionado e ignorado
- **Categoría**: Seguridad / DevOps
- **Ubicación**: `.env.example` y `.gitignore`
- **Descripción**: `.env.example` contiene un secreto real (`API_KEY_PROYECTO_11=6KqBvZyXpJ5mWkR8tHsUdC2eAoF3LiG7`) y placeholders `auth_pXX_secret`. El archivo fue añadido a `.gitignore` (aparece listado dos veces). Ignorar la plantilla es contraproducente: los nuevos desarrolladores pierden la referencia y, si el archivo estuvo trackeado antes, el secreto **permanece en el historial de git** aunque se elimine ahora del tracking.
- **Evidencia**:
  ```
  # .gitignore
  .env.example
  ...
  .env.example
  ```
  ```
  # .env.example
  API_KEY_PROYECTO_11=6KqBvZyXpJ5mWkR8tHsUdC2eAoF3LiG7
  ```
- **Fix recomendado**: Commitear un `.env.example` **sin secretos** (solo nombres de variables o placeholders obvios como `changeme`), quitarlo del `.gitignore`, y purgar/rotar cualquier secreto que haya quedado en el historial (`git filter-repo`/rotación de credenciales).

### [🔵 Low] Secreto de carga en `package.json` versionado
- **Categoría**: Seguridad / DevOps
- **Ubicación**: `package.json`
- **Descripción**: El script `test:load` embebe `API_KEY=auth_p08_secret`. Aunque parezca placeholder, refleja la convención real de claves y queda versionado (también en `backup/`).
- **Evidencia**:
  ```json
  "test:load": "k6 run -e API_KEY=auth_p08_secret apps/backend/test/load/ingestion-stress.js"
  ```
- **Fix recomendado**: Leer la clave desde variable de entorno externa, sin valor por defecto en el script.

### [🔵 Low] Inconsistencia de puerto de base de datos
- **Categoría**: DevOps / Calidad
- **Ubicación**: `.env.example` (`DB_PORT=5432`) vs `docker-compose.yml` (`5433:5432`) y `apps/backend/src/app.module.ts` (default `5433`)
- **Descripción**: Ejecutando el backend localmente contra el contenedor, el puerto de host es 5433, pero `.env.example` sugiere 5432. Fricción de onboarding y errores de conexión.
- **Fix recomendado**: Alinear `.env.example` a `DB_PORT=5433` (o documentar claramente los dos escenarios local/Docker).

### [🔵 Low] Deduplicación de incidentes por título exacto
- **Categoría**: Calidad / Arquitectura
- **Ubicación**: `apps/backend/src/worker/worker.service.ts`
- **Descripción**: La deduplicación busca incidente activo con `titulo` exactamente igual. Variaciones mínimas en el título normalizado generan tickets duplicados; títulos idénticos de fallas distintas se agrupan erróneamente.
- **Fix recomendado**: Deduplicar por una clave estable (`crmTicketId`/`externalId` + `sistema_id`) en lugar del título.

---

## Technical Debt Assessment

| Ítem de deuda | Impacto |
|---|---|
| `RolesGuard` con bypass `TODO` de roles | Alto — riesgo de acceso indebido; bloquea go-live real |
| Duplicación de lógica de validación de API keys entre 3 guards (`ZeroTrust`, `P06`, `Hybrid`) | Medio — inconsistencia de seguridad y mantenimiento |
| `crm_ticket_id` poblado pero no usado; id resuelto desde payload | Medio — lógica redundante y frágil; comentarios contradictorios |
| Acoplamiento a formatos de respuesta externos (CRM `ticket.estado`, P9 envelope) sin DTOs | Medio — roturas silenciosas ante cambios de contrato |
| Fire-and-forget silencioso hacia P9 sin reintentos ni auth | Medio — pérdida de eventos analíticos sin visibilidad |
| Uso de `any` en `req.user`, respuestas CRM y payloads | Bajo — pérdida de seguridad de tipos |
| Naming engañoso (`P06ApiKeyGuard` valida P07) | Bajo — riesgo operativo en rotación de secretos |
| `.env.example` ignorado / sin plantilla limpia | Bajo — fricción de onboarding |
| `version: '3.9'` obsoleto en docker-compose; Redis sin auth ni healthcheck | Bajo — configuración no productiva |

---

## Security Assessment

| Severidad | Categoría OWASP | Archivo | Estado |
|---|---|---|---|
| 🔴 Critical | A02 Cryptographic Failures / Secrets | `apps/backend/src/p6-notificaciones/p6-notificaciones.service.ts` | Abierto |
| 🟠 High | A01 Broken Access Control | `apps/backend/src/auth/guards/roles.guard.ts` | Abierto |
| 🟠 High | A09 Logging / A07 Auth | `apps/backend/src/auth/guards/p06-api-key.guard.ts` | Abierto |
| 🟠 High | A05 Security Misconfiguration | `apps/backend/src/events/events.gateway.ts`, `apps/backend/src/main.ts` | Abierto |
| 🟠 High | A02/A05 (TLS) | `apps/backend/src/app.module.ts` | Abierto |
| 🟠 High | A04 Insecure Design (secreto compartido inbound/outbound) | `apps/backend/src/incidentes/incidentes.service.ts` | Abierto |
| 🟡 Medium | A02 Secrets in VCS | `.env.example`, `package.json` | Abierto |
| 🟡 Medium | A07 Timing Attack | `apps/backend/src/auth/guards/hybrid-auth.guard.ts` | Abierto |
| 🟡 Medium | A05 (WebSocket sin auth) | `apps/backend/src/events/events.gateway.ts` | Abierto |
| 🔵 Low | A05 (Redis sin auth, compose obsoleto) | `docker-compose.yml` | Abierto |

---

## Refactoring Roadmap

### 🔴 Inmediato (bloquea producción)
- Eliminar el default hardcodeado `API_KEY_PROYECTO_11` y **rotar** el secreto comprometido.
- Corregir el bypass de `RolesGuard`: denegar por defecto o condicionar a entorno no productivo.
- Mover la API key del endpoint `estado-ticket` a header exclusivamente; eliminar soporte por query string.
- Restringir CORS (HTTP y WebSocket) al dominio del frontend y añadir `helmet`.
- Corregir `rejectUnauthorized` para TLS de DB/Redis (usar CA válida).

### 🟠 Corto plazo (próximo sprint)
- Separar credenciales inbound/outbound del CRM y renombrar `P06ApiKeyGuard`.
- Unificar validación de API keys en un helper timing-safe compartido (elimina el `!==` de `HybridAuthGuard`).
- Autenticar el handshake WebSocket con JWT.
- Añadir auth y validación de contrato al webhook P09; convertir `Error` genérico de `eliminarComentario` en `ForbiddenException`.
- Limpiar `.env.example` (sin secretos), sacarlo de `.gitignore` y purgar/rotar secretos del historial.

### 🟡 Mediano plazo
- Usar `incidente.crmTicketId` en `resolverIdTicketCrm`; eliminar la resolución vía `eventos_alerta`.
- Corregir el seed de P09 (Analítica) con nueva migración y validar solapamientos con P05.
- Introducir DTOs/validación para respuestas externas (CRM, P9) y timeouts + concurrencia acotada en el cron CRM.
- Añadir un filtro global de excepciones y correlación de logs.

### 🔵 Largo plazo
- Reemplazar tipos `any` (`req.user`, payloads, respuestas externas) por interfaces tipadas.
- Estrategia de deduplicación de incidentes basada en identificador estable.
- Endurecer infraestructura: Redis con auth/healthcheck, actualizar `docker-compose`, pipeline CI con escaneo de secretos (gitleaks) y SAST.

---

## Production Readiness Assessment

- **Score**: 4/10
- **Riesgos principales de despliegue**:
  - Secreto real comprometido en código y en `.env.example` (y posiblemente en historial de git).
  - Bypass de autorización activo en producción (`RolesGuard`).
  - Superficie de exposición ampliada por CORS `*`, WebSocket sin auth y TLS sin validación de certificado.
  - Integraciones frágiles: contrato P09 desalineado, sincronización CRM acoplada a formato externo sin validación, webhook P9 sin auth.
- **Condiciones requeridas antes de producción**:
  1. Rotar todos los secretos expuestos y eliminar defaults hardcodeados.
  2. Cerrar el bypass de `RolesGuard`.
  3. Endurecer CORS/Helmet/TLS y autenticar WebSocket.
  4. Mover credenciales fuera de query string.
  5. Sanear `.env.example` y purgar secretos del historial.
  6. Validar contratos de integración (CRM/P9) y corregir el seed de P09.

---

## Final Verdict

**¿Aprobarías este proyecto para despliegue en producción? — No (Condicionalmente tras remediación).**

Justificación: la base arquitectónica es sólida para un MVP —modularidad clara, transacciones correctas, colas, validación de entrada con `whitelist`/`forbidNonWhitelisted`, rate limiting global y uso de `timingSafeEqual` en dos de los tres guards—, lo que indica buen criterio de ingeniería. Sin embargo, existen defectos de seguridad de severidad crítica/alta que son explotables directamente o que rompen el modelo de control de acceso: un secreto real embebido en el código, un bypass de autorización sin condición de entorno, credenciales por query string y configuración de red/TLS insegura. Ninguno de estos es aceptable frente a miles de usuarios. Con las remediaciones "Inmediato" y "Corto plazo" del roadmap completadas y verificadas, el proyecto puede pasar a una aprobación **condicional**.

### Puntuaciones estimadas
- **Mantenibilidad**: 6/10
- **Deuda técnica**: 5/10 (10 = sin deuda)
- **Preparación para producción**: 4/10
