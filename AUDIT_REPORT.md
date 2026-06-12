# Reporte de Auditoría Técnica — Proyecto 11 MochiCode

> **Fecha:** 2026-06-11  
> **Auditor:** Project Reviewer Agent (arquitecto senior, auditor OWASP, DevOps, QA lead)  
> **Alcance:** Backend completo (`apps/backend/src/`)

---

## Executive Summary

El proyecto es un **monolito modular NestJS** bien estructurado para su etapa de desarrollo universitario. La separación por dominios es correcta, las migraciones son atómicas, las transacciones están bien implementadas y la cobertura de tests es sólida. Sin embargo, presenta **vulnerabilidades de seguridad críticas** que lo hacen inapto para producción en su estado actual: ausencia total de autenticación en la mitad de los endpoints, credenciales de base de datos hardcodeadas como fallback, y ausencia de rate limiting, CORS y Helmet. El proyecto tiene buen ADN de ingeniería pero necesita un sprint de hardening antes de cualquier despliegue real.

---

## Top Critical Findings

1. 🔴 **Sin autenticación en `GET /api/v1/incidentes` y `PATCH /api/v1/incidentes/:id/estado`** — `incidentes.controller.ts`
2. 🔴 **Credencial de BD hardcodeada como fallback** — `app.module.ts` y `data-source.ts`
3. 🟠 **Sin rate limiting** — el endpoint público `/api/v1/alertas` acepta volumen ilimitado
4. 🟠 **Sin CORS ni Helmet configurados** — `main.ts`
5. 🟠 **Redis sin autenticación ni TLS** — `docker-compose.yml`
6. 🟠 **`usuarioId` llega por body, no desde el token** — `update-estado-incidente.dto.ts`
7. 🟠 **Doble inserción de auditoría al crear incidente** — `worker.service.ts` + trigger SQL
8. 🟡 **Paginación sin límite máximo de `limit`** — `get-incidentes.dto.ts`
9. 🟡 **`payload: any` sin validación de estructura** — `create-alerta.dto.ts`
10. 🟡 **`AppService.getHealth()` instancia un cliente Redis en cada llamada** — `app.service.ts`

---

## Detailed Findings

---

### 🔴 [Critical] Endpoints de incidentes completamente abiertos sin autenticación

- **Categoría:** Seguridad
- **Ubicación:** `apps/backend/src/incidentes/incidentes.controller.ts` → `IncidentesController`
- **Descripción:** `GET /api/v1/incidentes` y `PATCH /api/v1/incidentes/:id/estado` no tienen ningún guard. Cualquier cliente en internet puede leer todos los incidentes o cambiar su estado sin ninguna credencial.
- **Evidencia:**
  ```typescript
  @Controller('incidentes')
  export class IncidentesController {
    @Get()          // ← sin @UseGuards(...)
    findAll(@Query() query: GetIncidentesDto) { ... }

    @Patch(':id/estado')   // ← sin @UseGuards(...)
    cambiarEstado(...) { ... }
  }
  ```
- **Fix recomendado:** Aplicar `@UseGuards(ZeroTrustGuard)` (solución temporal) o el guard JWT de P12 en ambos métodos. El `PATCH` especialmente es una operación de escritura que jamás debe quedar abierta.

---

### 🔴 [Critical] Contraseña de base de datos hardcodeada como fallback

- **Categoría:** Seguridad (OWASP A07 – Identification and Authentication Failures)
- **Ubicación:** `apps/backend/src/app.module.ts` línea 27 y `apps/backend/src/database/data-source.ts` línea 12
- **Descripción:** Si `DB_PASSWORD` no está definida en el `.env`, la aplicación arranca con `'postgres'` como contraseña. En un entorno de staging o CI que olvide configurar la variable, la BD quedaría expuesta con credenciales conocidas.
- **Evidencia:**
  ```typescript
  password: configService.get<string>('DB_PASSWORD', 'postgres'),  // app.module.ts
  password: process.env.DB_PASSWORD ?? 'postgres',                  // data-source.ts
  ```
- **Fix recomendado:** Usar `configService.getOrThrow('DB_PASSWORD')` para que la aplicación falle al arrancar si la variable no está definida, en lugar de arrancar con credenciales inseguras.

---

### 🟠 [High] Sin rate limiting en ningún endpoint

- **Categoría:** Seguridad (OWASP A05 – Security Misconfiguration)
- **Ubicación:** `apps/backend/src/main.ts`
- **Descripción:** No hay `@nestjs/throttler` ni ningún middleware de rate limiting. El endpoint `POST /api/v1/alertas` —diseñado para recibir alertas de IoT— puede ser explotado para DoS o para inundar la cola Redis con millones de jobs.
- **Fix recomendado:**
  ```typescript
  // app.module.ts
  ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])
  // + @UseGuards(ThrottlerGuard) en los controllers
  ```

---

### 🟠 [High] Sin CORS ni Helmet en `main.ts`

- **Categoría:** Seguridad
- **Ubicación:** `apps/backend/src/main.ts`
- **Descripción:** No se configura `app.enableCors()` con lista de orígenes permitidos, ni `app.use(helmet())`. Esto expone la API a ataques CSRF desde cualquier origen y elimina los headers de seguridad HTTP estándar (`X-Frame-Options`, `Content-Security-Policy`, etc.).
- **Fix recomendado:**
  ```typescript
  import helmet from 'helmet';
  app.use(helmet());
  app.enableCors({ origin: process.env.ALLOWED_ORIGINS?.split(',') });
  ```

---

### 🟠 [High] Redis expuesto sin contraseña ni TLS

- **Categoría:** Seguridad / DevOps
- **Ubicación:** `docker-compose.yml`
- **Descripción:** Redis arranca sin `--requirepass`. La cola BullMQ (que contiene todos los jobs de alertas en tránsito) es accesible por cualquier proceso en la red Docker `p11_network` sin autenticación. Si otro contenedor comprometido accede a la red, puede vaciar o inyectar jobs maliciosos en la cola.
- **Fix recomendado:**
  ```yaml
  command: redis-server --requirepass ${REDIS_PASSWORD} --save 60 1
  ```
  Y configurar `REDIS_PASSWORD` en el `.env` y en `BullModule.forRootAsync`.

---

### 🟠 [High] `usuarioId` llegando por body en vez de ser extraído del token

- **Categoría:** Seguridad (OWASP A01 – Broken Access Control)
- **Ubicación:** `apps/backend/src/incidentes/dto/update-estado-incidente.dto.ts`
- **Descripción:** El `usuarioId` que queda registrado en el historial de auditoría lo provee el cliente en el body. Cualquier cliente puede impersonar a otro usuario enviando un UUID arbitrario. El propio código lo documenta como TODO pero es un riesgo de integridad en auditoría.
- **Evidencia:**
  ```typescript
  // TODO: Esto debería extraerse del token JWT en el request cuando la auth esté implementada.
  @IsUUID()
  usuarioId!: string;
  ```
- **Fix recomendado:** Extraer `request.user.sub` del token JWT decorado por el guard de P12, no confiar en el cliente para proveer su propio ID.

---

### 🟠 [High] Doble inserción en tabla `auditoria` al crear un incidente

- **Categoría:** Fiabilidad / Integridad de datos
- **Ubicación:** `apps/backend/src/worker/worker.service.ts` + `apps/backend/src/database/migrations/CreateIncidentAuditTrigger.ts`
- **Descripción:** Cuando se crea un incidente nuevo, `WorkerService` inserta manualmente un registro en `auditoria` (paso 3d). Al mismo tiempo, el trigger SQL `trg_audit_incident_creation` también inserta automáticamente en `auditoria` ante cada `INSERT` en `incidentes`. El resultado es **dos filas de auditoría por cada incidente creado**.
- **Evidencia:**
  ```typescript
  // worker.service.ts — inserción manual
  await queryRunner.query(`INSERT INTO "auditoria" ... 'Incidente creado automáticamente...'`);

  // trigger SQL — inserción automática simultánea
  INSERT INTO auditoria (...) VALUES (NEW.id, ..., 'Creación de ticket', ...);
  ```
- **Fix recomendado:** Elegir una sola estrategia. El trigger es más robusto (funciona aunque alguien inserte por otro camino); eliminar el INSERT manual del `WorkerService` para la rama de creación.

---

### 🟡 [Medium] Paginación sin límite máximo en `limit`

- **Categoría:** Seguridad / Performance
- **Ubicación:** `apps/backend/src/incidentes/dto/get-incidentes.dto.ts`
- **Descripción:** Un cliente puede enviar `?limit=100000` y forzar al ORM a traer toda la tabla de incidentes en una sola query. El campo solo tiene `@Min(1)`, sin `@Max()`.
- **Evidencia:**
  ```typescript
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // ← Falta @Max(100)
  limit?: number = 10;
  ```
- **Fix recomendado:** Agregar `@Max(100)` al campo `limit`.

---

### 🟡 [Medium] `payload` acepta cualquier objeto sin validación de estructura

- **Categoría:** Seguridad / Calidad
- **Ubicación:** `apps/backend/src/ingestion/dto/create-alerta.dto.ts`
- **Descripción:** `payload!: Record<string, any>` valida que sea un objeto pero acepta cualquier contenido, incluyendo objetos anidados excesivamente profundos que pueden causar ataques de prototype pollution o consumo exagerado de memoria al serializar a JSONB.
- **Fix recomendado:** Agregar un custom validator de tamaño máximo o `@ValidateNested()` si el contrato del payload lo permite.

---

### 🟡 [Medium] `AppService.getHealth()` crea y destruye un cliente Redis en cada llamada

- **Categoría:** Performance / Fiabilidad
- **Ubicación:** `apps/backend/src/app.service.ts`
- **Descripción:** Cada llamada a `GET /health` instancia un `createClient`, conecta, hace ping y desconecta. Si el endpoint de health es consultado por un load balancer cada 5 segundos (como es habitual), genera ruido innecesario en la conexión Redis y puede enmascarar errores de conexión transitorios como "down" permanente.
- **Evidencia:**
  ```typescript
  async getHealth() {
    const redisClient = createClient({ url: redisUrl }); // ← nueva instancia por cada llamada
    await redisClient.connect();
    await redisClient.ping();
    // ...
  }
  ```
- **Fix recomendado:** Inyectar el cliente Redis existente de BullMQ via `@InjectQueue` o crear un cliente Redis singleton a nivel de módulo.

---

### 🟡 [Medium] Política SLA siempre selecciona la más restrictiva, sin considerar criticidad

- **Categoría:** Lógica de negocio
- **Ubicación:** `apps/backend/src/worker/worker.service.ts`
- **Descripción:** La política SLA se elige así: `order: { tiempoMaximoResolucionMinutos: 'ASC' }` — siempre la más restrictiva. Si hay múltiples políticas (P1 Crítico=60min, P3 Normal=480min), todos los incidentes automáticos recibirán la política de 60 minutos, independientemente de la severidad real del evento.
- **Fix recomendado:** El payload debería incluir un campo `nivel_criticidad` para seleccionar la política correcta. El código ya tiene un comentario TODO al respecto.

---

### 🔵 [Low] `prioridad` como `varchar` sin enum ni constraint en BD

- **Categoría:** Calidad / Integridad de datos
- **Ubicación:** `apps/backend/src/database/entities/incidente.entity.ts`
- **Descripción:** `prioridad` es `varchar(50)` con default `'MEDIA'` pero sin validación ni enum en BD. Un cliente puede enviar cualquier string arbitrario y quedará persistido.
- **Fix recomendado:** Crear un tipo ENUM en PostgreSQL (`BAJA`, `MEDIA`, `ALTA`, `CRITICA`) igual que se hizo con `incidente_estado_enum`.

---

### 🔵 [Low] `AppService` importa el paquete `redis` directamente duplicando la conexión

- **Categoría:** Arquitectura / Acoplamiento
- **Ubicación:** `apps/backend/src/app.service.ts`
- **Descripción:** Se importa el paquete `redis` directamente para el health check, duplicando la dependencia de conexión a Redis que ya existe vía BullMQ. Dos clientes distintos para el mismo servidor Redis.
- **Fix recomendado:** Usar `@InjectQueue('alertas-queue')` y verificar el estado a través de la conexión existente del queue.

---

### 🔵 [Low] Suite e2e de ingestion con 3 bugs conocidos (fix revertido)

- **Categoría:** Tests
- **Ubicación:** `apps/backend/test/ingestion.e2e-spec.ts`
- **Descripción:** El `VALID_PAYLOAD` no incluye `creado_en` (campo requerido por el DTO), el módulo de test no provee `ConfigService` ni registra `ZeroTrustGuard` causando error de DI, y el CASO 5 espera `400` cuando el guard intercepta primero y lanza `401`. Estos 3 bugs hacen fallar el suite e2e de ingestion.

---

## Technical Debt Assessment

| Ítem | Impacto | Esfuerzo estimado |
|---|---|---|
| Integración real con JWT de P12 (auth pendiente) | Crítico | Alto |
| Rate limiting global (`@nestjs/throttler`) | Alto | Bajo |
| CORS + Helmet en `main.ts` | Alto | Bajo |
| Contraseña Redis en producción | Alto | Bajo |
| `configService.getOrThrow()` para credenciales BD | Alto | Mínimo |
| Eliminar doble auditoría (trigger vs manual) | Medio | Bajo |
| `@Max(100)` en paginación | Medio | Mínimo |
| `prioridad` como ENUM en BD | Bajo | Bajo |
| Health check con cliente reutilizado | Bajo | Bajo |
| Corrección suite e2e ingestion (3 bugs) | Medio | Bajo |
| Selección dinámica de SLA por criticidad | Medio | Medio |

---

## Security Assessment

| Severidad | Categoría OWASP | Archivo | Descripción |
|---|---|---|---|
| 🔴 Critical | A01 Broken Access Control | `incidentes.controller.ts` | Endpoints de lectura y escritura sin autenticación |
| 🔴 Critical | A07 Auth Failures | `app.module.ts`, `data-source.ts` | Contraseña BD hardcodeada como fallback `'postgres'` |
| 🟠 High | A05 Security Misconfiguration | `main.ts` | Sin CORS configurado |
| 🟠 High | A05 Security Misconfiguration | `main.ts` | Sin Helmet (headers de seguridad HTTP) |
| 🟠 High | A05 Security Misconfiguration | `main.ts` | Sin rate limiting |
| 🟠 High | A05 Security Misconfiguration | `docker-compose.yml` | Redis sin contraseña ni TLS |
| 🟠 High | A01 Broken Access Control | `update-estado-incidente.dto.ts` | `usuarioId` controlado por el cliente, no extraído del token |

---

## Refactoring Roadmap

### 🔴 Inmediato (bloquea producción)

1. Agregar `@UseGuards(ZeroTrustGuard)` a los dos métodos de `IncidentesController`
2. Cambiar `configService.get('DB_PASSWORD', 'postgres')` → `configService.getOrThrow('DB_PASSWORD')` en `app.module.ts` y `data-source.ts`
3. Agregar `app.use(helmet())` y `app.enableCors(...)` en `main.ts`
4. Corregir los 3 bugs del suite e2e de ingestion

### 🟠 Corto plazo (próximo sprint)

5. Instalar y configurar `@nestjs/throttler` con límite global
6. Agregar `--requirepass ${REDIS_PASSWORD}` a Redis en Docker Compose
7. Eliminar el INSERT manual de auditoría en `WorkerService` (dejar solo el trigger SQL)
8. Agregar `@Max(100)` al campo `limit` del DTO de paginación

### 🟡 Mediano plazo

9. Integrar guard JWT de P12 y extraer `usuarioId` del token en lugar del body
10. Implementar selección dinámica de política SLA por `nivel_criticidad` en el payload
11. Convertir `prioridad` en tipo ENUM en la migración de PostgreSQL

### 🔵 Largo plazo

12. Refactorizar `AppService.getHealth()` para reutilizar la conexión BullMQ existente
13. Agregar validación de profundidad/tamaño máximo al campo `payload` del DTO de ingesta

---

## Production Readiness Assessment

- **Score: 4/10**

**Riesgos principales de despliegue:**
- Los endpoints de incidentes expuestos sin autenticación son un vector de ataque inmediato
- Redis sin contraseña en cualquier entorno con red compartida
- Sin rate limiting, el endpoint de ingesta es un vector de DoS directo contra la cola Redis
- Los tests e2e están rotos (fix revertido), reduciendo la confianza en el pipeline de CI

**Condiciones requeridas antes de producción:**
- Todos los ítems del bloque "🔴 Inmediato" resueltos y verificados
- Archivo `.env.example` documentado con nombres de variables (sin valores reales)
- Pipeline CI que ejecute `test:e2e` con `--forceExit` antes de cualquier merge a main

---

## Final Verdict

**¿Aprobarías este proyecto para despliegue en producción? → No, condicionalmente.**

La arquitectura base es sólida: monolito modular bien separado, transacciones atómicas correctas, migraciones ordenadas, TimescaleDB aprovechado apropiadamente, y una cobertura de tests unitarios que demuestra criterio de ingeniería. El equipo claramente sabe lo que hace.

Sin embargo, el proyecto tiene **dos vulnerabilidades críticas que serían explotadas en minutos** en producción real: los endpoints de lectura y escritura de incidentes están completamente abiertos, y la base de datos arrancaría con contraseña `postgres` si alguien olvida configurar el `.env`. Sumado a la ausencia de rate limiting, CORS y Helmet, la superficie de ataque es inaceptable para un sistema que está diseñado para integrarse con 6 proyectos externos.

Los problemas del bloque "🔴 Inmediato" pueden resolverse en **menos de 1 jornada de trabajo**. Con esos cambios aplicados, el proyecto pasaría a ser apto para un despliegue controlado en staging.

---

**Puntuaciones finales:**

| Dimensión | Score |
|---|---|
| Mantenibilidad | 7/10 |
| Deuda técnica | 5/10 |
| Preparación para producción | 4/10 |
