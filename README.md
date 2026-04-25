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

3. Levanta servicios de infraestructura:

```bash
docker compose up -d
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

## Build

```bash
npm run build
```

## Diagrama Entidad-Relación (Base de Datos)

```mermaid
erDiagram
    SISTEMAS {
        string sistema_id PK "Ej: P1, P2, P8"
        string nombre
        string descripcion
    }

    POLITICAS_SLA {
        uuid id PK
        string nombre
        int tiempo_maximo_resolucion_minutos
    }

    INCIDENTES {
        uuid id PK
        string titulo
        string descripcion
        string estado "ABIERTO, EN_PROGRESO, CERRADO"
        string sistema_id FK
        uuid creador_usuario_id "Referencia a P12"
        uuid politica_sla_id FK
        datetime creado_en
    }

    EVENTOS_ALERTA {
        uuid id PK
        datetime creado_en "Clave para TimescaleDB"
        jsonb payload
        string sistema_id FK
        uuid incidente_id FK "Opcional"
    }

    HISTORIAL_ESTADOS {
        uuid id PK
        uuid incidente_id FK
        string estado_anterior
        string estado_nuevo
        uuid cambiado_por_usuario_id "Referencia a P12"
        datetime cambiado_en
    }

    REGLAS_ESCALAMIENTO {
        uuid id PK
        uuid politica_sla_id FK
        int tiempo_activacion_minutos
        uuid notificar_a_usuario_id "Referencia a P12"
    }

    AUDITORIA {
        uuid id PK
        uuid incidente_id FK
        uuid accion_por_usuario_id "Referencia a P12"
        string descripcion_accion
        datetime creado_en
    }

    EVIDENCIAS {
        uuid id PK
        uuid incidente_id FK
        string url_archivo
        string descripcion
        datetime subido_en
    }

    ACCIONES_PLAYBOOK {
        uuid id PK
        uuid incidente_id FK
        string tipo_accion
        uuid ejecutado_por_usuario_id "Referencia a P12"
        datetime ejecutado_en
    }

    %% Relaciones
    SISTEMAS ||--o{ INCIDENTES : "genera"
    POLITICAS_SLA ||--o{ INCIDENTES : "aplica a"
    INCIDENTES ||--o{ HISTORIAL_ESTADOS : "registra"
    POLITICAS_SLA ||--o{ REGLAS_ESCALAMIENTO : "define"
    INCIDENTES ||--o{ EVENTOS_ALERTA : "agrupa"
    SISTEMAS ||--o{ EVENTOS_ALERTA : "emite"
    INCIDENTES ||--o{ AUDITORIA : "audita"
    INCIDENTES ||--o{ EVIDENCIAS : "respalda"
    INCIDENTES ||--o{ ACCIONES_PLAYBOOK : "ejecuta"
```
