# Proyecto 11 
Monorepo con:
- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Base de datos: PostgreSQL
- Cache: Redis
- ORM: TypeORM
- Contenedores: Docker Compose

## Estructura

```txt
apps/
  frontend/
  backend/
docker-compose.yml
package.json
```

## Requisitos

- Node.js 20+
- npm 10+
- Docker Desktop

## Configuracion inicial

1. Instala dependencias del monorepo:

```bash
npm install
```

3. Levanta los servicios de infraestructura (Base de datos y Redis):

```bash
docker compose up -d
```

4. Ejecuta las migraciones para crear las tablas en la base de datos:

```bash
npm run migration:run
```

## Desarrollo

Ejecuta backend y frontend en dos terminales:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

- Frontend: http://localhost:3000
- API Health: http://localhost:3001/api/health

> [!WARNING]
> **Modificación de Tipos Compartidos (`@proyecto/shared-types`)**
> Si en algún momento modificas las interfaces o tipos dentro de `packages/shared-types/src`, debes compilar el paquete para que el backend y frontend reconozcan los cambios.
> 
> Para hacerlo, ejecuta:
> ```bash
> cd packages/shared-types
> npm run build
> ```
> *(Esto actualizará la carpeta `dist/` con las declaraciones de TypeScript. Si no lo haces, obtendrás el error `Cannot find module '@proyecto/shared-types'` al levantar el servidor).*

## Build

```bash
npm run build
```

## Diagrama Entidad-Relación (Base de Datos)

```mermaid
erDiagram
    SISTEMAS {
        varchar sistema_id PK "Ej: P1, P2, P8"
        varchar nombre
        varchar descripcion
    }

    POLITICAS_SLA {
        uuid id PK
        varchar nombre
        int tiempo_maximo_resolucion_minutos
    }

    INCIDENTES {
        uuid id PK
        varchar titulo
        varchar descripcion
        varchar estado "ABIERTO, EN_PROGRESO, CERRADO"
        varchar sistema_id FK
        uuid creador_usuario_id "Referencia a P12 (Identidad)"
        uuid politica_sla_id FK
        datetime creado_en
        uuid asignado_a_usuario_id "Referencia a P12 (Identidad), opcional"
        varchar prioridad "BAJA, MEDIA, ALTA, CRITICA"
        datetime fecha_resolucion "Opcional"
    }

    EVENTOS_ALERTA {
        uuid id PK
        datetime creado_en "Clave para TimescaleDB"
        jsonb payload
        varchar sistema_id FK
        uuid incidente_id FK "Opcional, agrupa alertas"
    }

    HISTORIAL_ESTADOS {
        uuid id PK
        uuid incidente_id FK
        varchar estado_anterior
        varchar estado_nuevo
        uuid cambiado_por_usuario_id "Referencia a P12 (Identidad)"
        datetime cambiado_en
    }

    REGLAS_ESCALAMIENTO {
        uuid id PK
        uuid politica_sla_id FK
        int tiempo_activacion_minutos
        uuid notificar_a_usuario_id "Referencia a P12 (Identidad)"
    }

    AUDITORIA {
        uuid id PK
        uuid incidente_id FK
        uuid accion_por_usuario_id "Referencia a P12 (Identidad)"
        varchar descripcion_accion
        datetime creado_en
    }

    EVIDENCIAS {
        uuid id PK
        uuid incidente_id FK
        varchar url_archivo
        varchar descripcion
        datetime subido_en
    }

    ACCIONES_PLAYBOOK {
        uuid id PK
        uuid incidente_id FK
        varchar tipo_accion
        uuid ejecutado_por_usuario_id "Referencia a P12 (Identidad)"
        datetime ejecutado_en
    }

    %% Relaciones
    SISTEMAS ||--o{ INCIDENTES : "genera"
    POLITICAS_SLA ||--o{ INCIDENTES : "aplica a"
    SISTEMAS ||--o{ EVENTOS_ALERTA : "emite"
    INCIDENTES ||--o{ EVENTOS_ALERTA : "agrupa"
    INCIDENTES ||--o{ HISTORIAL_ESTADOS : "registra"
    POLITICAS_SLA ||--o{ REGLAS_ESCALAMIENTO : "define"
    INCIDENTES ||--o{ AUDITORIA : "audita"
    INCIDENTES ||--o{ EVIDENCIAS : "respalda"
    INCIDENTES ||--o{ ACCIONES_PLAYBOOK : "ejecuta"

```

## 📚 Referencia de la API

> [!NOTE]
> **Nota para la Evaluación Académica**
> Por requerimientos estrictos de la rúbrica de evaluación, el endpoint de creación de incidentes (`POST /api/v1/incidentes`) permite asignar manualmente el `creadorUsuarioId` directamente desde el payload del frontend, para poder simular que somos otros sistemas creando reportes. En un entorno productivo real, esto constituye una vulnerabilidad (BOLA) y el identificador siempre debe ser forzado extrayéndolo de manera segura del token JWT del usuario autenticado.

Todas las peticiones principales de la API deben dirigirse a la ruta base `/api/v1` (ej. `http://localhost:3001/api/v1`).

### 1. Operaciones (DevOps / Infraestructura)
Verifica el estado de salud del backend y sus conexiones internas. Ideal para los *Healthchecks* de Docker.

**Endpoint:** `GET /health`

**Respuestas Esperadas:**
- ✅ **200 OK:** El sistema está operativo y conectado a la BD/Redis.
- ❌ **503 Service Unavailable:** Falla en la conexión a la infraestructura subyacente.

---

### 2. Ingesta (Sistemas Externos: P1, P2, P8)
El sistema utiliza Redis para encolar alertas masivas de forma asíncrona, protegiendo la base de datos principal. Los sistemas externos deben utilizar este endpoint para reportar incidentes.

**Endpoint:** `POST /api/v1/alertas`

**Headers Requeridos:**
- `Content-Type: application/json`
- `x-api-key: <LLAVE_SECRETA_DEL_SISTEMA>` *(ZeroTrustGuard validará estrictamente que la llave corresponda al sistema emisor).*

#### Estructura del Payload (Request)
El sistema emisor debe enviar un JSON con la siguiente estructura estricta:

```json
{
  "sistema_id": "P8", 
  "creado_en": "2026-05-26T15:30:00Z",
  "payload": {
    "sensor_id": "termometro-bodega-norte",
    "temperatura": 85.5,
    "estado": "critico"
    // Cualquier dato adicional estructurado (JSON válido)
  }
}
```
*Nota: Cualquier campo fuera de `sistema_id`, `creado_en` y `payload` en el nivel raíz será rechazado automáticamente por el servidor (Error 400).*

**Respuestas Esperadas:**
- ✅ **202 Accepted:** La alerta fue recibida y encolada exitosamente.
- ❌ **400 Bad Request:** Faltan campos obligatorios o se enviaron campos no permitidos.
- ❌ **401 Unauthorized:** No se proporcionó API Key o las credenciales no coinciden con el `sistema_id`.
- ❌ **500 Internal Server Error:** Falla en la infraestructura de encolado (Redis inactivo).

---

### 3. Incidentes (Frontend UI)
Obtiene la lista de incidentes persistidos en PostgreSQL. Este endpoint retorna meta-información matemática para facilitar la renderización de tablas y la paginación en la interfaz de usuario.

**Endpoint:** `GET /api/v1/incidentes`

#### Parámetros de Consulta (Query Params - Opcionales)
| Parámetro | Tipo | Default | Descripción |
| :--- | :--- | :--- | :--- |
| `page` | `number` | `1` | Página actual de resultados. |
| `limit` | `number` | `10` | Cantidad de registros por página. |
| `estado` | `string` | `null` | Filtrar por estado (`ABIERTO`, `EN_PROGRESO`, `CERRADO`). |
| `sistema_id` | `string` | `null` | Filtrar por el sistema de origen (ej. `P8`, `P1`). |
| `orden` | `string` | `DESC` | Ordenamiento por fecha de creación (`ASC` o `DESC`). |

#### Ejemplo de Petición
`GET /api/v1/incidentes?page=1&limit=5&estado=ABIERTO&orden=DESC`

#### Respuesta Exitosa (200 OK)
```json
{
  "data": [
    {
      "id": "e8a2a0a2-2b3a-4a6c-9b1b-7c1a8e1a9b2b",
      "titulo": "[P8] Alerta automática — 2026-05-26T20:33:29.839Z",
      "descripcion": "Payload inicial: {\"sensor_id\":\"termometro-bodega-norte\",\"temperatura\":95.5}",
      "estado": "ABIERTO",
      "sistemaId": "P8",
      "creadorUsuarioId": "00000000-0000-0000-0000-000000000001",
      "politicaSlaId": "11111111-1111-1111-1111-111111111111",
      "creadoEn": "2026-05-26T20:33:29.834Z"
    }
  ],
  "meta": {
    "total_registros": 42,
    "pagina_actual": 1,
    "total_paginas": 9,
    "registros_por_pagina": 5
  }
}
```

## ⚙️ Worker de Procesamiento Asíncrono

Una vez que la alerta es encolada en Redis, el **Worker** la desencola automáticamente y la persiste en PostgreSQL. Este componente corre dentro del mismo proceso NestJS como un consumidor BullMQ.

### Flujo completo

```
POST /ingestion/alertas
  → ZeroTrustGuard valida x-api-key
    → IngestionService encola job en Redis (alertas-queue)
      → AlertasProcessor desencola automáticamente
        → WorkerService.procesarAlerta()
          → Transacción: INSERT incidente + INSERT evento_alerta en PostgreSQL
```

### Archivos del Worker

| Archivo | Responsabilidad |
|---|---|
| `src/worker/worker.processor.ts` | Consumidor BullMQ — escucha `alertas-queue` y recibe cada job |
| `src/worker/worker.service.ts` | Lógica de negocio — valida datos y ejecuta la transacción en PostgreSQL |
| `src/worker/worker.module.ts` | Módulo NestJS — registra la cola, entidades y proveedores |
| `src/database/entities/sistema.entity.ts` | Entidad TypeORM para la tabla `sistemas` |
| `src/database/entities/politica-sla.entity.ts` | Entidad TypeORM para la tabla `politicas_sla` |
| `src/database/entities/incidente.entity.ts` | Entidad TypeORM para la tabla `incidentes` |

### Pasos internos de `WorkerService.procesarAlerta()`

1. **Validar sistema** — Busca el `sistema_id` en la tabla `sistemas`. Si no existe, lanza un error y BullMQ reintenta el job (máx. 3 veces).
2. **Buscar política SLA** — Obtiene la política SLA por defecto (la de menor tiempo de resolución).
3. **Transacción atómica** — Abre un `QueryRunner` y ejecuta en una sola transacción:
   - `INSERT` en `incidentes` vía repositorio TypeORM (título generado automáticamente como `[P1] Alerta automática — {timestamp}`)
   - `INSERT` en `eventos_alerta` vía **SQL raw** (requerido por el hypertable de TimescaleDB con clave primaria compuesta `id + creado_en`)
4. **Rollback automático** — Si cualquier INSERT falla, ambas operaciones se revierten y el error se relanza para que BullMQ reintente.

### Nota sobre `creador_usuario_id`

Los incidentes generados automáticamente usan el UUID centinela `00000000-0000-0000-0000-000000000001` como actor sistema. Este valor debe ser reemplazado por el `JWT.sub` de P12 cuando la integración de autenticación esté completa.

## 🔌 Arquitectura de Integración (API RESTful)

La Plataforma de Gestión de Incidentes Operacionales (Proyecto 11) actúa como un embudo central de información y un distribuidor de acciones. A continuación se detallan los endpoints expuestos (para recibir datos) y los consumidos (para enviar datos).

---

### 📥 1. Endpoints Expuestos (Nuestra API)
Estos son los puertos de entrada de nuestra plataforma. Los proyectos que son nuestras **Dependencias** (P01, P02, P03, P04, P05, P07, P08, P12) consumirán estos endpoints para reportar anomalías.

#### A. Ingesta de Alertas de los Sistemas
* **Endpoint:** `POST /api/v1/alertas`
* **Consumidor:** Sistemas de IoT (P08), Pasarela de Pagos (P04), Logística (P02), etc.
* **Descripción:** Inserta un registro de alerta temporal (Timeseries) para ser evaluado y potencialmente agrupado en un incidente.
* **Payload esperado (JSON):**
```json
  {
    "sistema_id": "P8", 
    "creado_en": "2026-05-26T15:30:00Z",
    "payload": {
      "sensor_id": "TEMP-001",
      "error": "Temperatura fuera de rango",
      "valor_actual": 8.5
    }
  }

```

#### B. Creación Manual / Escalamiento de Incidentes

* **Endpoint:** `POST /api/v1/incidentes`
* **Consumidor:** CRM (P07) o Frontend P11.
* **Descripción:** Crea un incidente formal, asigna una política de SLA y registra el evento en la tabla de auditoría.
* **Payload esperado (JSON):**

```json
  {
    "titulo": "Caída masiva pasarela de pagos",
    "descripcion": "Transacciones rechazadas con error 500",
    "sistema_id": "P4",
    "creador_usuario_id": "uuid-del-operador",
    "politica_sla_id": "uuid-sla-critico"
  }

```

#### C. Actualización de Estados

* **Endpoint:** `PATCH /api/v1/incidentes/{id}/estado`
* **Consumidor:** Frontend P11.
* **Descripción:** Actualiza el estado de un incidente (Ej. ABIERTO -> EN_PROGRESO) y genera un registro en el historial de estados.
* **Payload esperado (JSON):**

```json
  {
    "estado_nuevo": "EN_PROGRESO",
    "cambiado_por_usuario_id": "uuid-del-operador"
  }

```

#### D. Extracción de Datos para Analítica (Pull)

* **Endpoint:** `GET /api/v1/incidentes/metricas`
* **Consumidor:** Analítica y BI (P09).
* **Descripción:** Endpoint de consulta periódica para extraer historial de incidentes, SLAs cumplidos y tiempos medios de resolución (MTTR).

---

### 📤 2. Endpoints Consumidos (Servicios Externos)

Estas son las peticiones que **nuestra plataforma (P11)** hará hacia los **Consumidores** externos cuando ocurran eventos que requieran su participación.

#### A. Hacia Notificaciones Multicanal (P06)

* **Endpoint Destino:** `POST /api/v1/notificaciones/enviar`
* **Cuándo se llama:** Al crear un incidente crítico o al incumplir una regla de escalamiento por vencimiento de SLA.
* **Payload enviado (JSON):**

```json
  {
    "usuario_destino_id": "uuid-del-guardia",
    "canal": "URGENTE_PUSH",
    "mensaje": "SLA Vencido: Incidente P4 - Caída de Pagos requiere atención inmediata",
    "incidente_id": "uuid-del-incidente"
  }

```

#### B. Hacia Identidad y Accesos (P12)

* **Endpoint Destino:** `GET /api/v1/usuarios/{uuid}`
* **Cuándo se llama:** Para enriquecer la información visual del dashboard (obtener el nombre y rol del operador a partir de su UUID).

#### C. Hacia Analítica y BI (P09) - Modo Push (Opcional)

* **Endpoint Destino:** `POST /api/v1/ingesta/eventos-operacionales`
* **Cuándo se llama:** Al momento de marcar un incidente como "CERRADO", enviando el resumen, causas y playbooks ejecutados para retroalimentación analítica.

---

### 🔄 Resumen del Flujo de Datos Operacional

1. Los proyectos **(P01 al P08)** envían telemetría y errores a `/api/v1/alertas`.
2. El **Proyecto 11** agrupa estas alertas en un `INCIDENTE`.
3. El **Proyecto 11** solicita al **Proyecto 06** que notifique a los técnicos correspondientes.
4. Los operadores (autenticados vía **Proyecto 12**) mitigan el problema y cierran el incidente.
5. El **Proyecto 09** extrae la data histórica del incidente para calcular métricas de rendimiento y SLAs.