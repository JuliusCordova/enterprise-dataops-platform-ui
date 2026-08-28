# Plan de implementación — CRUD de Calidad de Datos y Reconciliación

> Estado: plan base para ejecución incremental  
> Frontend: `JuliusCordova/enterprise-dataops-platform-ui`  
> Backend de dominio: `jarvis-reconciliation-agent`  
> Basado en: matriz de routing, ADR-001 y especificación canónica CRUD

## 1. Objetivo

Implementar una experiencia CRUD empresarial para configuraciones de **calidad de datos** y **reconciliación**, manteniendo al backend como fuente de verdad y al frontend como BFF/experiencia de usuario.

El alcance funcional mínimo es:

`Create → Read → Update as new version → Validate → Publish → Deactivate → Reactivate → Archive → Historical read`

## 2. Principios de ejecución

1. No se construye lógica de persistencia en el frontend.
2. No se modifica directamente una versión `ACTIVE`.
3. Toda edición de una versión publicada crea una nueva versión `DRAFT`.
4. El archivado es lógico; no se elimina evidencia histórica.
5. Las ejecuciones siempre referencian la versión exacta utilizada.
6. No se aceptan configuraciones `LOCAL_*` como persistidas o publicadas.
7. No se agregan endpoints al frontend sin contrato backend certificado.
8. Cada fase termina con pruebas contractuales y evidencia reproducible.

## 3. Resultado arquitectónico esperado

```text
Browser
  │
  ▼
enterprise-dataops-platform-ui
  ├── Quality Configuration UI
  ├── Reconciliation Configuration UI
  ├── BFF /ui/api/data-quality/**
  └── BFF /ui/api/reconciliation/**
          │
          ▼
jarvis-reconciliation-agent
  ├── Configuration API
  ├── Versioning and lifecycle
  ├── Validation
  ├── Audit
  ├── Persistence
  └── Execution references
```

Configuración esperada:

```yaml
backends:
  reconciliation:
    base-url: ${RECONCILIATION_BACKEND_BASE_URL}
  silver:
    base-url: ${SILVER_BACKEND_BASE_URL}
```

## 4. Fases de implementación

### Fase 0 — Certificación del contrato actual

**Objetivo:** conocer exactamente qué expone hoy `jarvis-reconciliation-agent`.

Actividades:

- obtener `/openapi.json` o especificación equivalente;
- inventariar endpoints de calidad y reconciliación;
- clasificar cada contrato como `EXISTS`, `PARTIAL`, `INCOMPATIBLE` o `MISSING`;
- comparar request/response DTOs con el BFF actual;
- documentar autenticación, timeouts y errores;
- identificar persistencia real y modelo de datos vigente;
- confirmar repositorio y branch de despliegue del backend.

Entregables:

- matriz `endpoint esperado vs endpoint real`;
- OpenAPI archivado como evidencia;
- lista de brechas P0/P1;
- decisión de compatibilidad o versionado de API.

Gate:

- ningún desarrollo backend comienza sin esta matriz.

---

### Fase 1 — Modelo de dominio y persistencia

**Objetivo:** definir las entidades canónicas y su ciclo de vida.

Actividades backend:

- definir `QualityConfiguration` y `ReconciliationConfiguration`;
- definir `ConfigurationVersion` o equivalente por dominio;
- definir estados `DRAFT`, `VALIDATED`, `ACTIVE`, `INACTIVE`, `ARCHIVED`;
- agregar auditoría `created_by`, `updated_by`, `published_by` y timestamps;
- agregar `expected_version` o `etag` para concurrencia optimista;
- registrar la versión usada en cada ejecución;
- definir reglas de transición de estado;
- preparar migraciones o scripts de evolución de esquema.

Reglas críticas:

- una sola versión `ACTIVE` por configuración;
- publicar una nueva versión inactiva la anterior de forma controlada;
- una configuración con ejecuciones históricas no puede borrarse físicamente;
- no se puede archivar una configuración con ejecución activa.

Entregables:

- modelo lógico y físico;
- migraciones versionadas;
- pruebas unitarias de transiciones de estado;
- ADR de versionado y archivado.

Gate:

- migraciones probadas en ambiente no productivo;
- transición de estados cubierta por tests.

---

### Fase 2 — API CRUD backend

**Objetivo:** implementar contratos completos y estables.

#### Calidad de datos

```text
POST   /data-quality/configurations
GET    /data-quality/configurations
GET    /data-quality/configurations/{id}
GET    /data-quality/configurations/{id}/versions
GET    /data-quality/configurations/{id}/versions/{version}
PUT    /data-quality/configurations/{id}
POST   /data-quality/configurations/{id}/validate
POST   /data-quality/configurations/{id}/publish
POST   /data-quality/configurations/{id}/versions
PATCH  /data-quality/configurations/{id}/status
DELETE /data-quality/configurations/{id}
```

#### Reconciliación

```text
POST   /reconciliation/configurations
GET    /reconciliation/configurations
GET    /reconciliation/configurations/{id}
GET    /reconciliation/configurations/{id}/versions
GET    /reconciliation/configurations/{id}/versions/{version}
PUT    /reconciliation/configurations/{id}
POST   /reconciliation/configurations/{id}/validate
POST   /reconciliation/configurations/{id}/publish
POST   /reconciliation/configurations/{id}/versions
PATCH  /reconciliation/configurations/{id}/status
DELETE /reconciliation/configurations/{id}
```

Controles obligatorios:

- paginación y filtros;
- idempotency key en creación y publicación;
- control optimista;
- errores normalizados;
- validación de conexión, dataset, tabla y columnas;
- auditoría completa;
- OpenAPI actualizado;
- compatibilidad temporal con endpoints legacy cuando sea necesario.

Entregables:

- API backend funcional;
- OpenAPI versionado;
- pruebas unitarias e integración;
- colección de smoke tests.

Gate:

- CRUD backend completo para ambos dominios;
- smoke backend exitoso sin frontend.

---

### Fase 3 — Separación y fortalecimiento del BFF

**Objetivo:** evitar que el frontend dependa de un cliente genérico único y ambiguo.

Actividades frontend:

- crear clientes separados por bounded context;
- mover integración de calidad y reconciliación a paquetes específicos;
- mantener `/ui/api/**` como contrato estable para el navegador;
- mapear errores backend a respuestas uniformes;
- configurar timeouts y retries solo para operaciones idempotentes;
- incluir correlation ID;
- eliminar hardcode de URL por defecto en producción;
- deshabilitar falsos éxitos `LOCAL_*` en ambientes integrados;
- conservar fallback solo como modo demo explícito y visible, si se decide mantenerlo.

Estructura objetivo:

```text
integration/reconciliation/
  ReconciliationConfigurationClient
  ReconciliationExecutionClient
  dto/
integration/quality/
  QualityConfigurationClient
  QualityExecutionClient
  dto/
```

Entregables:

- clientes separados;
- DTOs tipados;
- configuración por ambiente;
- pruebas de controlador y cliente;
- eliminación de ambigüedad del `DataOpsApiClient` genérico.

Gate:

- ninguna llamada de calidad/reconciliación usa URL o DTO del backend Silver;
- contract tests BFF↔backend en verde.

---

### Fase 4 — UX CRUD de calidad de datos

**Objetivo:** completar la administración empresarial de configuraciones de calidad.

Pantallas/acciones:

- catálogo con búsqueda, filtros y paginación;
- detalle de configuración;
- crear borrador;
- editar borrador;
- validar;
- publicar;
- editar una configuración activa creando nueva versión;
- activar/desactivar;
- archivar con confirmación;
- consultar historial y comparar versiones;
- duplicar configuración como nuevo borrador.

Controles UX:

- badge visible de estado y versión;
- bloqueo de edición directa de `ACTIVE`;
- advertencia de concurrencia;
- mensajes reales de persistencia;
- prohibición de mostrar `LOCAL_*` como publicado;
- confirmación antes de desactivar o archivar.

Gate:

- recorrido E2E completo de calidad exitoso.

---

### Fase 5 — UX CRUD de reconciliación

**Objetivo:** completar la administración empresarial de reconciliaciones.

Pantallas/acciones:

- catálogo con estado, owner, origen y destino;
- detalle de configuración;
- crear y editar borrador;
- validar estructura y reglas;
- publicar;
- nueva versión desde una configuración activa;
- activar/desactivar;
- archivar;
- historial de versiones;
- ejecución desde una versión activa;
- trazabilidad del resultado hacia configuración y versión.

Controles UX:

- visualización clara de fuente y destino;
- business keys y métricas comparadas;
- tolerancias y matching visibles;
- bloqueo de ejecución de una versión no activa;
- historial que muestre quién publicó y cuándo.

Gate:

- recorrido E2E completo de reconciliación exitoso.

---

### Fase 6 — Pruebas, seguridad y observabilidad

**Objetivo:** certificar confiabilidad antes de producción.

Pruebas mínimas:

- unitarias backend y frontend;
- contract tests OpenAPI;
- integración BFF↔backend;
- E2E por dominio;
- concurrencia optimista;
- idempotencia;
- publicación repetida;
- archivado con ejecuciones históricas;
- autorización por rol;
- smoke post-deploy;
- regresión de ejecución de calidad y reconciliación.

Observabilidad:

- correlation ID desde navegador hasta backend;
- logs estructurados;
- métricas por operación CRUD;
- errores por endpoint y estado;
- latencia p50/p95;
- auditoría de cambios de configuración;
- alerta ante fallos de publicación o archivado.

Gate:

- cero defectos P0;
- smoke completo en candidato;
- evidencia de rollback preparada.

---

### Fase 7 — Despliegue incremental

**Objetivo:** liberar sin interrumpir la operación actual.

Estrategia:

1. desplegar backend compatible sin retirar endpoints legacy;
2. ejecutar migraciones;
3. validar API nueva con smoke independiente;
4. desplegar frontend candidato a 0%;
5. ejecutar smoke de catálogo, detalle, versión y lifecycle;
6. promover gradualmente;
7. observar métricas y errores;
8. retirar endpoints legacy en un release posterior.

Rollback:

- rollback de frontend independiente;
- rollback de backend sin revertir migraciones destructivamente;
- feature flags para activar CRUD nuevo;
- mantener lectura legacy durante transición.

## 5. Orden recomendado de entrega

| Incremento | Alcance | Valor demostrable |
|---|---|---|
| I1 | OpenAPI certificado + modelo de dominio | Arquitectura ordenada y brechas reales |
| I2 | Listar, consultar y crear borrador | Catálogo administrable |
| I3 | Editar, validar y publicar | Flujo funcional completo básico |
| I4 | Nueva versión + activar/desactivar | Gobierno del ciclo de vida |
| I5 | Archivado + historial | Auditoría empresarial |
| I6 | UX completa + E2E + observabilidad | Release productivo confiable |

## 6. Plan de sprints sugerido

### Sprint A — Discovery y contrato

- Fase 0 completa;
- modelo canónico validado;
- backlog técnico cerrado;
- no incluye cambios productivos.

### Sprint B — Backend foundation

- persistencia y migraciones;
- listado, detalle y creación;
- pruebas unitarias.

### Sprint C — Lifecycle backend

- actualización, validación y publicación;
- versionado;
- activar/desactivar;
- archivado lógico;
- historial.

### Sprint D — BFF y calidad de datos

- clientes separados;
- CRUD frontend de calidad;
- contract tests.

### Sprint E — Reconciliación

- CRUD frontend de reconciliación;
- integración con ejecución;
- trazabilidad de versión.

### Sprint F — Hardening y release

- E2E;
- seguridad;
- observabilidad;
- candidato 0%;
- smoke;
- promoción y rollback probado.

## 7. Roles sugeridos

| Rol | Responsabilidad principal |
|---|---|
| Arquitectura | Contratos, bounded contexts, ADR y gates |
| Backend Engineer | Persistencia, API, lifecycle y auditoría |
| Frontend/BFF Engineer | Clientes, DTOs, controladores y UX |
| QA Automation | Contract, integración, E2E y smoke |
| DevOps/Platform | CI/CD, candidate, promoción y rollback |
| Product Owner/Data Governance | Estados, permisos, archivado y criterios de aceptación |

## 8. Dependencias y riesgos

| Riesgo | Mitigación |
|---|---|
| OpenAPI no representa producción | Comparar OpenAPI, código y smoke real |
| Endpoints legacy incompatibles | Capa de compatibilidad temporal |
| Fallback local oculta errores | Deshabilitarlo o marcarlo como demo explícito |
| Migración rompe ejecuciones históricas | Referenciar versión exacta y usar migración aditiva |
| Edición concurrente | `etag` o `expected_version` |
| Archivo de configuración activa | Validación de estado y ejecución activa |
| DTOs genéricos | Separación por dominio y contract tests |
| Frontend y backend se despliegan juntos | Releases independientes y backward compatibility |

## 9. Definition of Done global

El alcance se considera completo cuando, para calidad y reconciliación:

- existe catálogo paginado;
- se puede crear y recuperar un borrador;
- se puede editar con control de concurrencia;
- se puede validar y publicar;
- editar una versión activa crea un nuevo draft;
- se puede desactivar y reactivar;
- se puede archivar lógicamente;
- el historial conserva todas las versiones;
- una ejecución referencia la versión exacta;
- no hay persistencia local simulada;
- contract tests y E2E están en verde;
- existe smoke candidato y producción;
- rollback está probado.

## 10. Próximo paso controlado

Ejecutar únicamente **Sprint A — Discovery y contrato**:

1. identificar el repositorio exacto de `jarvis-reconciliation-agent`;
2. extraer OpenAPI de la revisión productiva;
3. generar la matriz de compatibilidad;
4. confirmar persistencia y autenticación;
5. convertir las brechas en backlog ejecutable.

No iniciar aún la construcción de endpoints ni pantallas CRUD hasta cerrar este gate.