# Requerimientos Funcionales del Grupo 11: Plataforma de Gestión de Incidentes Operacionales

Basado en el contexto del proyecto, estos son los requerimientos funcionales detallados para el **Grupo 11 - Plataforma de Gestión de Incidentes Operacionales**:

---

## 1. REGISTRO Y GESTIÓN DE INCIDENTES

### 1.1 Creación de Incidentes
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-01 | El sistema debe permitir registrar incidentes mediante un formulario estandarizado que incluya: categoría, gravedad, origen del sistema afectado, responsables asignados y descripción del problema. | Alta |
| RF-11-02 | El formulario debe permitir adjuntar evidencias (archivos, capturas, logs) y vincular eventos de otros proyectos (IDs de pedidos, transacciones, visitas, etc.). | Alta |
| RF-11-03 | El sistema debe permitir la creación de incidentes desde alertas automáticas provenientes de otros sistemas (IoT, pagos, logística, salud, etc.). | Alta |
| RF-11-04 | El sistema debe capturar metadata temporal (timestamp de detección, timestamp de registro) para cada incidente. | Alta |

### 1.2 Categorización y Clasificación
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-05 | El sistema debe soportar categorías predefinidas de incidentes: técnicos, operacionales, de seguridad, de servicio, de proveedores, etc. | Alta |
| RF-11-06 | El sistema debe permitir clasificar la gravedad del incidente en niveles: Crítico, Alto, Medio, Bajo. | Alta |
| RF-11-07 | El sistema debe permitir asignar el origen del incidente (proyecto/sistema afectado) desde una lista de sistemas disponibles (Proyectos 1-12). | Alta |

### 1.3 Asignación y Responsables
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-08 | El sistema debe permitir asignar uno o más responsables a cada incidente, con roles definidos (líder técnico, responsable de comunicación, etc.). | Alta |
| RF-11-09 | El sistema debe notificar automáticamente a los responsables asignados vía el Proyecto 6 (Notificaciones multicanal). | Alta |
| RF-11-10 | El sistema debe soportar reasignación de responsables durante el ciclo de vida del incidente. | Media |

---

## 2. PRIORIZACIÓN Y ESCALAMIENTO

### 2.1 Reglas de Priorización
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-11 | El sistema debe aplicar reglas automáticas de priorización basadas en: criticidad del servicio afectado, número de usuarios impactados, tiempo de resolución estimado y gravedad del incidente. | Alta |
| RF-11-12 | El sistema debe permitir configuración de reglas de priorización por parte de administradores. | Media |
| RF-11-13 | El sistema debe recalcular prioridad automáticamente cuando se actualiza la información del incidente (ej: aumenta el número de afectados). | Media |

### 2.2 Rutas de Escalamiento
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-14 | El sistema debe definir niveles SLA según criticidad con tiempos objetivo de respuesta y resolución: | Alta |
|    | - Crítico: Respuesta < 15 min, Resolución < 2 horas | |
|    | - Alto: Respuesta < 30 min, Resolución < 4 horas | |
|    | - Medio: Respuesta < 2 horas, Resolución < 8 horas | |
|    | - Bajo: Respuesta < 4 horas, Resolución < 24 horas | |
| RF-11-15 | El sistema debe escalar automáticamente el incidente al siguiente nivel cuando se supera el tiempo de respuesta/resolución definido en SLA. | Alta |
| RF-11-16 | El sistema debe notificar al equipo de escalamiento (supervisores, gerentes) al activarse una escalada. | Alta |
| RF-11-17 | El sistema debe permitir escalamiento manual por parte de los responsables del incidente. | Media |

---

## 3. SEGUIMIENTO Y ACTUALIZACIÓN

### 3.1 Gestión del Ciclo de Vida
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-18 | El sistema debe gestionar los estados del incidente: Nuevo, Asignado, En Investigación, En Resolución, Resuelto, Cerrado, Reabierto. | Alta |
| RF-11-19 | El sistema debe permitir registrar actualizaciones (comentarios, avances, cambios de estado, adjuntos) en el incidente. | Alta |
| RF-11-20 | El sistema debe mantener un historial completo y trazable de todas las acciones realizadas sobre cada incidente. | Alta |

### 3.2 Tiempos y SLA
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-21 | El sistema debe calcular y mostrar automáticamente el tiempo transcurrido desde la creación del incidente y el tiempo restante según SLA. | Alta |
| RF-11-22 | El sistema debe generar alertas cuando un incidente se acerca a su límite SLA (ej: 80% del tiempo transcurrido). | Alta |
| RF-11-23 | El sistema debe permitir pausar el contador SLA en casos justificados (espera de información externa, etc.). | Media |

---

## 4. PANEL OPERATIVO Y VISUALIZACIÓN

### 4.1 Tablero de Incidentes
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-24 | El sistema debe proporcionar un tablero operativo con vista general de incidentes activos, incluyendo: ID, título, gravedad, estado, responsable, tiempo transcurrido y SLA restante. | Alta |
| RF-11-25 | El tablero debe permitir filtrar incidentes por: estado, gravedad, categoría, sistema afectado, responsable, fecha de creación y prioridad. | Alta |
| RF-11-26 | El tablero debe mostrar tendencias de incidentes: incidentes por día, por categoría, tiempo promedio de resolución, etc. | Media |

### 4.2 Seguimiento en Tiempo Real
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-27 | El tablero debe actualizarse automáticamente en tiempo real cuando hay cambios en los incidentes. | Alta |
| RF-11-28 | El sistema debe permitir ver el detalle completo de cada incidente con todo su historial y comunicaciones asociadas. | Alta |
| RF-11-29 | El sistema debe proporcionar una vista "Mi Tablero" para que cada usuario vea incidentes asignados y notificaciones pendientes. | Media |

---

## 5. COMUNICACIÓN Y NOTIFICACIONES

### 5.1 Notificaciones a Involucrados
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-30 | El sistema debe notificar vía Proyecto 6 a los responsables cuando se les asigna un incidente. | Alta |
| RF-11-31 | El sistema debe notificar a los equipos afectados (proyectos origen) cuando se crea un incidente que les impacta. | Alta |
| RF-11-32 | El sistema debe notificar a stakeholders relevantes (gerentes, POs) cuando hay cambios de estado críticos (ej: escalamiento). | Alta |
| RF-11-33 | El sistema debe enviar recordatorios periódicos a responsables sobre incidentes abiertos cerca de vencer SLA. | Media |

### 5.2 Comunicación Interna
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-34 | El sistema debe permitir agregar comentarios y comunicación interna dentro del incidente, con menciones a otros usuarios. | Alta |
| RF-11-35 | El sistema debe soportar plantillas de comunicación estandarizadas para diferentes tipos de incidentes. | Media |
| RF-11-36 | El sistema debe permitir enviar actualizaciones masivas a clientes afectados (vía CRM) cuando sea necesario. | Media |

---

## 6. INTEGRACIONES CON OTROS SISTEMAS

### 6.1 Ingestión de Alertas
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-37 | El sistema debe recibir eventos entrantes desde todos los proyectos con metadata de series temporales para crear incidentes automáticos. | Alta |
| RF-11-38 | El sistema debe consumir alertas desde IoT (Proyecto 8) para activos críticos (desviaciones, pérdida de conexión, umbrales superados). | Alta |
| RF-11-39 | El sistema debe consumir alertas desde Pagos (Proyecto 4) por fallas de transacción o conciliación. | Alta |
| RF-11-40 | El sistema debe consumir alertas desde Logística (Proyecto 2) por retrasos, accidentes o incidencias en rutas. | Alta |
| RF-11-41 | El sistema debe consumir alertas desde Salud (Proyecto 1) por visitas sin registro en plazo esperado. | Alta |
| RF-11-42 | El sistema debe consumir alertas desde Notificaciones (Proyecto 6) por fallas críticas en el servicio. | Alta |

### 6.2 Conexiones Salientes
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-43 | El sistema debe notificar al Proyecto 6 cuando se crean o actualizan incidentes para enviar alertas a los responsables. | Alta |
| RF-11-44 | El sistema debe enviar datos de incidentes al Proyecto 9 (Analítica) para reportes de tendencias, métricas y prevención. | Alta |
| RF-11-45 | El sistema debe enlazarse con CRM (Proyecto 7) para comunicar a clientes afectados cuando el incidente impacta en servicio. | Media |
| RF-11-46 | El sistema debe consultar al Proyecto 12 para obtener información de usuarios y roles al asignar responsables. | Media |

---

## 7. POST MORTEM Y MEJORA CONTINUA

### 7.1 Cierre de Incidentes
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-47 | El sistema debe requerir validación de resolución antes de permitir el cierre de un incidente. | Alta |
| RF-11-48 | El sistema debe generar un resumen automático al cerrar el incidente con: duración, acciones tomadas, sistemas afectados. | Alta |

### 7.2 Análisis de Causa Raíz y Prevención
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-49 | El sistema debe permitir registrar análisis de causa raíz para incidentes cerrados. | Alta |
| RF-11-50 | El sistema debe permitir documentar acciones preventivas derivadas del incidente. | Alta |
| RF-11-51 | El sistema debe asociar incidentes recurrentes para identificar patrones y generar alertas proactivas. | Media |

### 7.3 Playbooks y Runbooks
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-52 | El sistema debe permitir crear y gestionar playbooks/runbooks con pasos de acción para diferentes tipos de incidentes. | Media |
| RF-11-53 | El sistema debe sugerir automáticamente playbooks relevantes basados en la categoría y origen del incidente. | Media |
| RF-11-54 | El sistema debe permitir a los usuarios ejecutar acciones desde playbooks (ej: reiniciar servicio, escalar, etc.). | Media |

---

## 8. REPORTES Y ANALÍTICA

### 8.1 Dashboards de Desempeño
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-55 | El sistema debe proporcionar dashboards con métricas clave: tiempo medio de respuesta (MTTR), tiempo medio de resolución (MTTR), incidentes abiertos/cerrados, distribución por gravedad. | Alta |
| RF-11-56 | El sistema debe mostrar tendencias de incidentes por período (diario, semanal, mensual). | Media |
| RF-11-57 | El sistema debe permitir exportar reportes de incidentes en formatos CSV, Excel y PDF. | Media |

### 8.2 Reportes a Analítica
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-58 | El sistema debe exportar datos anonimizados de incidentes al Proyecto 9 para análisis de patrones recurrentes y prevención. | Alta |
| RF-11-59 | El sistema debe generar informes automáticos de desempeño de SLA para la gerencia. | Media |

---

## 9. REQUERIMIENTOS TRANSVERSALES

### 9.1 Seguridad y Auditoría
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-60 | El sistema debe registrar en un log de auditoría inmutable todas las acciones realizadas sobre incidentes (creación, actualización, cierre, escalamiento). | Alta |
| RF-11-61 | El sistema debe implementar control de acceso basado en roles: Administrador, Gestor de Incidentes, Responsable Técnico, Observador. | Alta |
| RF-11-62 | El sistema debe validar identidad y permisos mediante el Proyecto 12 para todas las operaciones. | Alta |

### 9.2 Disponibilidad y Desempeño
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-63 | El sistema debe garantizar una disponibilidad mínima del 99.5% (SLA interno). | Alta |
| RF-11-64 | El sistema debe responder a múltiples incidentes simultáneos sin degradación de performance. | Alta |
| RF-11-65 | El sistema debe tener capacidad de failover y recuperación ante caídas. | Media |

### 9.3 Usabilidad
| ID | Requerimiento | Prioridad |
|----|--------------|-----------|
| RF-11-66 | El sistema debe contar con una interfaz intuitiva para la gestión de incidentes. | Alta |
| RF-11-67 | El sistema debe ser accesible desde dispositivos móviles y de escritorio. | Media |
| RF-11-68 | El sistema debe permitir búsqueda avanzada de incidentes por múltiples criterios (texto libre, fechas, categorías, etc.). | Alta |

---

## MATRIZ DE DEPENDENCIAS DEL GRUPO 11

| Proyecto | Tipo de Dependencia | Descripción |
|----------|---------------------|-------------|
| **Proyecto 6** | Consumidor | Envía notificaciones a responsables y equipos sobre incidentes |
| **Proyecto 9** | Consumidor | Envía datos de incidentes para análisis y reportes de tendencias |
| **Proyecto 12** | Consumidor | Valida identidad y permisos de usuarios |
| **Proyecto 1** | Proveedor | Recibe alertas de salud (visitas sin registro) |
| **Proyecto 2** | Proveedor | Recibe alertas de logística (retrasos, incidencias en rutas) |
| **Proyecto 3** | Proveedor | Recibe alertas de pedidos (inconsistencias, fallas) |
| **Proyecto 4** | Proveedor | Recibe alertas de pagos (fallas de transacción) |
| **Proyecto 5** | Proveedor | Recibe alertas de inventario (stock crítico, inconsistencias) |
| **Proyecto 7** | Bidireccional | Enlaza incidentes con tickets de soporte y clientes afectados |
| **Proyecto 8** | Proveedor | Recibe alertas de IoT (sensores, activos críticos) |
| **Proyecto 10** | Proveedor | Recibe alertas de suscripciones (fallas de cobro) |

---

Este conjunto de requerimientos funcionales cubre todas las necesidades especificadas en el contexto del proyecto para el **Grupo 11 - Plataforma de Gestión de Incidentes Operacionales**, asegurando una gestión completa del ciclo de vida de incidentes y una integración efectiva con el ecosistema de proyectos.
