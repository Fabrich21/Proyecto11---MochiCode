# Evaluacion de Requerimientos Funcionales - Grupo 11

Fecha de evaluacion: 2026-07-06
Fuente base: [coherencia.md](coherencia.md)

## Resumen Ejecutivo

De los 68 requerimientos funcionales:

- Implementados: 9
- Parciales: 22
- No implementados: 37

## Evidencia Tecnica Revisada

- Backend incidentes: [apps/backend/src/incidentes/incidentes.controller.ts](apps/backend/src/incidentes/incidentes.controller.ts), [apps/backend/src/incidentes/incidentes.service.ts](apps/backend/src/incidentes/incidentes.service.ts)
- Ingesta y normalizacion: [apps/backend/src/ingestion/ingestion.controller.ts](apps/backend/src/ingestion/ingestion.controller.ts), [apps/backend/src/ingestion/ingestion.service.ts](apps/backend/src/ingestion/ingestion.service.ts), [apps/backend/src/ingestion/normalizer/payload-normalizer.service.ts](apps/backend/src/ingestion/normalizer/payload-normalizer.service.ts)
- SLA y escalamiento: [apps/backend/src/sla/sla.service.ts](apps/backend/src/sla/sla.service.ts), [apps/backend/src/sla/sla.scheduler.ts](apps/backend/src/sla/sla.scheduler.ts)
- Tiempo real: [apps/backend/src/events/events.gateway.ts](apps/backend/src/events/events.gateway.ts), [apps/frontend/src/hooks/useWebSockets.ts](apps/frontend/src/hooks/useWebSockets.ts)
- Dashboard/UI: [apps/frontend/src/components/incident-dashboard.tsx](apps/frontend/src/components/incident-dashboard.tsx), [apps/frontend/src/components/incident-detail-modal.tsx](apps/frontend/src/components/incident-detail-modal.tsx), [apps/frontend/src/components/sla-viewer.tsx](apps/frontend/src/components/sla-viewer.tsx)
- Modelo de datos: [apps/backend/src/database/entities/incidente.entity.ts](apps/backend/src/database/entities/incidente.entity.ts), [apps/backend/src/database/entities/auditoria.entity.ts](apps/backend/src/database/entities/auditoria.entity.ts), [apps/backend/src/database/entities/evidencia.entity.ts](apps/backend/src/database/entities/evidencia.entity.ts), [apps/backend/src/database/entities/accion-playbook.entity.ts](apps/backend/src/database/entities/accion-playbook.entity.ts)

---

## 1) Requerimientos Implementados

IDs implementados:

- RF-11-03
- RF-11-06
- RF-11-16
- RF-11-27
- RF-11-38
- RF-11-39
- RF-11-41
- RF-11-66
- RF-11-67

Evidencias clave:

- Creacion automatica por alertas + cola: [apps/backend/src/ingestion/ingestion.service.ts](apps/backend/src/ingestion/ingestion.service.ts), [apps/backend/src/worker/worker.processor.ts](apps/backend/src/worker/worker.processor.ts), [apps/backend/src/worker/worker.service.ts](apps/backend/src/worker/worker.service.ts)
- Clasificacion de gravedad/prioridad: [apps/backend/src/common/utils/priority-rules.engine.ts](apps/backend/src/common/utils/priority-rules.engine.ts)
- Escalamiento con notificacion a P6 por vencimiento SLA: [apps/backend/src/sla/sla.service.ts](apps/backend/src/sla/sla.service.ts)
- Tiempo real al crear incidente: [apps/backend/src/events/events.gateway.ts](apps/backend/src/events/events.gateway.ts), [apps/backend/src/worker/worker.service.ts](apps/backend/src/worker/worker.service.ts)
- Integraciones especificas P8/P4/P1: [apps/backend/src/ingestion/normalizer/strategies/p8-iot.strategy.ts](apps/backend/src/ingestion/normalizer/strategies/p8-iot.strategy.ts), [apps/backend/src/ingestion/normalizer/strategies/p4-pasarela.strategy.ts](apps/backend/src/ingestion/normalizer/strategies/p4-pasarela.strategy.ts), [apps/backend/src/ingestion/normalizer/strategies/p1-salud.strategy.ts](apps/backend/src/ingestion/normalizer/strategies/p1-salud.strategy.ts)
- UI usable en desktop/movil: [apps/frontend/src/components/incident-dashboard.tsx](apps/frontend/src/components/incident-dashboard.tsx)

---

## 2) Requerimientos Parciales

IDs parciales:

- RF-11-01
- RF-11-02
- RF-11-04
- RF-11-07
- RF-11-08
- RF-11-11
- RF-11-14
- RF-11-15
- RF-11-19
- RF-11-20
- RF-11-21
- RF-11-22
- RF-11-24
- RF-11-31
- RF-11-32
- RF-11-37
- RF-11-40
- RF-11-43
- RF-11-44
- RF-11-48
- RF-11-60
- RF-11-64

### Brechas detectadas en los parciales

- RF-11-01 y RF-11-08: existe estructura de incidente, pero no formulario completo ni asignacion multi-responsable con roles. Solo existe `asignadoAUsuarioId` opcional en [apps/backend/src/database/entities/incidente.entity.ts](apps/backend/src/database/entities/incidente.entity.ts).
- RF-11-02: existen entidades/tablas para evidencias, pero no endpoints ni flujo UI para adjuntar archivos. Ver [apps/backend/src/database/entities/evidencia.entity.ts](apps/backend/src/database/entities/evidencia.entity.ts).
- RF-11-04: se registra tiempo de creacion y timestamp de alerta, pero no modelado explicito separado para "deteccion" vs "registro" del incidente.
- RF-11-11: hay reglas automaticas de prioridad, pero no cubren formalmente todos los factores pedidos (usuarios impactados y tiempo estimado de resolucion). Ver [apps/backend/src/common/utils/priority-rules.engine.ts](apps/backend/src/common/utils/priority-rules.engine.ts).
- RF-11-14 y RF-11-15: hay vencimiento SLA y escalamiento por cron, pero falta SLA de respuesta y niveles exactos requeridos; el seed no contempla "CRITICA". Ver [apps/backend/src/database/migrations/SeedPoliticasSla1780000000002.ts](apps/backend/src/database/migrations/SeedPoliticasSla1780000000002.ts).
- RF-11-19 y RF-11-20: historial/auditoria se registran para parte del ciclo, pero no para todas las acciones funcionales esperadas (comentarios, adjuntos, comunicaciones completas).
- RF-11-21 y RF-11-22: el frontend calcula consumo/restante SLA, pero no hay motor de alerta formal al 80% con persistencia/evento dedicado. Ver [apps/frontend/src/components/sla-viewer.tsx](apps/frontend/src/components/sla-viewer.tsx).
- RF-11-24: el tablero muestra informacion operativa parcial; faltan campos y vistas completas de responsable/comunicaciones.
- RF-11-31 y RF-11-32: se notifica en escenarios de SLA vencido, no en todos los flujos criticos requeridos.
- RF-11-37 y RF-11-40: ingesta multiproyecto existe con fallback, pero no hay estrategia explicita para P2.
- RF-11-43 y RF-11-44: hay integracion saliente con P6/P9 en casos puntuales (SLA vencido/cierre), no en todas las creaciones y actualizaciones.
- RF-11-48: al cierre se calcula MTTR y se envia a P9, pero no hay resumen de cierre completo persistido.
- RF-11-60: hay auditoria, pero sin evidencia de inmutabilidad estricta.
- RF-11-64: arquitectura asincrona ayuda concurrencia, pero no hay evidencia de pruebas de capacidad/no degradacion.

---

## 3) Requerimientos No Implementados

IDs no implementados:

- RF-11-05
- RF-11-09
- RF-11-10
- RF-11-12
- RF-11-13
- RF-11-17
- RF-11-18
- RF-11-23
- RF-11-25
- RF-11-26
- RF-11-28
- RF-11-29
- RF-11-30
- RF-11-33
- RF-11-34
- RF-11-35
- RF-11-36
- RF-11-42
- RF-11-45
- RF-11-46
- RF-11-47
- RF-11-49
- RF-11-50
- RF-11-51
- RF-11-52
- RF-11-53
- RF-11-54
- RF-11-55
- RF-11-56
- RF-11-57
- RF-11-58
- RF-11-59
- RF-11-61
- RF-11-62
- RF-11-63
- RF-11-65
- RF-11-68

### Hallazgos criticos

- No existe endpoint de creacion manual de incidentes en backend. El controlador expone GET y PATCH de estado. Ver [apps/backend/src/incidentes/incidentes.controller.ts](apps/backend/src/incidentes/incidentes.controller.ts).
- El ciclo de estados requerido no esta completo (faltan estados como Nuevo, Asignado, En Investigacion, En Resolucion, Resuelto, Reabierto). Ver [packages/shared-types/src/incidentes.ts](packages/shared-types/src/incidentes.ts).
- No hay RBAC funcional ni integracion real con P12 para autorizacion de operaciones de negocio. Referencia: [apps/backend/src/incidentes/dto/update-estado-incidente.dto.ts](apps/backend/src/incidentes/dto/update-estado-incidente.dto.ts).
- No hay comentarios/menciones, plantillas de comunicacion ni comunicaciones masivas.
- No hay reportes exportables (CSV/Excel/PDF) ni panel analitico de tendencias completo.
- Playbooks/evidencias existen en modelo de datos, pero sin capa completa de servicios/controladores/UI para su gestion funcional.
- La busqueda/filtro avanzado RF-11-68 no esta implementado de forma completa (solo texto y severidad en frontend; estado/sistema en backend).

---

## 4) Recomendacion de Priorizacion (Sprints)

### Sprint 1 - Fundaciones operativas y seguridad

- RF-11-18, RF-11-47, RF-11-61, RF-11-62
- Completar maquina de estados, validaciones de cierre y RBAC real con P12.

### Sprint 2 - Operacion y notificaciones

- RF-11-09, RF-11-30, RF-11-31, RF-11-32, RF-11-43
- Orquestar notificaciones por asignacion, cambios criticos y eventos de ciclo de vida.

### Sprint 3 - Postmortem, analitica y reporting

- RF-11-49 a RF-11-59
- Causa raiz, acciones preventivas, dashboards KPI y exportaciones.

---

## 5) Observaciones Importantes

- Hay discrepancias entre README y estado actual del codigo en algunos endpoints y capacidades.
- El sistema ya tiene buena base tecnica (ingesta asincrona, normalizacion, persistencia, auditoria parcial, SLA scheduler, WebSockets), por lo que la brecha restante es mayormente de cobertura funcional y no de arquitectura base.
