# Matriz canónica Frontend → Backend

> Estado: **baseline de arquitectura validada parcialmente con evidencia de código**  
> Repositorio dueño: `JuliusCordova/enterprise-dataops-platform-ui`  
> Objetivo: evitar duplicidad de lógica, integraciones cruzadas y ownership ambiguo entre backends.

## 1. Verdades arquitectónicas

1. `enterprise-dataops-platform-ui` es el **frontend único** de la plataforma.
2. El frontend no debe implementar lógica de negocio de calidad, perfilamiento, reconciliación ni refinamiento Silver.
3. Cada módulo debe consumir un backend dueño mediante una capa BFF/servicio Spring Boot.
4. `jarvis-reconciliation-agent` es el backend configurado actualmente para perfilamiento, reglas de calidad, ejecución de calidad y reconciliación.
5. `silver-refinement-agent` es dueño del flujo Bronze→Silver, reglas/mapeos de refinamiento, ejecución Silver, gobierno operativo y AgentOps del flujo Silver.
6. Los endpoints exactos se consideran **verificados** solo cuando existen en OpenAPI o en el código del backend correspondiente y cuentan con evidencia de ejecución.
7. La existencia de rutas `/ui/api/**` en el frontend confirma un patrón BFF; no confirma por sí sola que el backend remoto soporte todos los contratos.

## 2. Hallazgo crítico del inventario

El frontend no está vacío ni completamente mockeado. Existen:

- controladores Spring MVC por módulo;
- servicios Java que actúan como BFF;
- DTOs específicos por bounded context;
- JavaScript que consume exclusivamente rutas internas `/ui/api/**`;
- una sola configuración remota: `dataops.api.base-url`;
- un valor por defecto que apunta a `jarvis-reconciliation-agent`.

Configuración actual detectada:

```yaml
dataops:
  api:
    base-url: ${DATAOPS_API_URL:https://jarvis-reconciliation-agent-913797829604.us-central1.run.app}
```

Conclusión: hoy los cuatro módulos funcionales de calidad están diseñados para pasar por un único backend remoto de Reconciliation/Quality. El frontend todavía no contiene una segunda configuración para `silver-refinement-agent`.

## 3. Matriz de routing funcional actualizada

| Módulo frontend | Capacidad de negocio | Backend dueño | Evidencia frontend | Estado real | Riesgo actual |
|---|---|---|---|---|---|
| `profiling` | Descubrimiento de conexiones, datasets, tablas y ejecución de profiling | `jarvis-reconciliation-agent` | `ProfilingApiController`, `ProfilingMetadataService`, `ProfilingExecutionService`, rutas `/ui/api/profiling/**` | **INTEGRACIÓN REAL EN BFF; contrato remoto por validar** | Existen dos generaciones de rutas (`connections/.../datasets` y `metadata/.../datasets`) que pueden divergir |
| `qualityrules` | Sugerencias, draft, actualización, validación, publicación y programación | `jarvis-reconciliation-agent` | `QualityRulesApiController`, `QualityRulesService`, rutas `/ui/api/quality-rules/**` | **INTEGRACIÓN REAL CON FALLBACK LOCAL** | El fallback local puede ocultar fallas del backend y generar reglas no persistidas |
| `qualityexecution` | Catálogo, ejecución, resultados e incidencias | `jarvis-reconciliation-agent` | `QualityExecutionApiController`, `QualityExecutionService`, rutas `/ui/api/quality-execution/**` | **INTEGRACIÓN REAL EN BFF; contrato remoto por validar** | Resultado e issues dependen de contratos remotos aún no contrastados con OpenAPI |
| `reconciliation` | Catálogo, configuración, validación, confirmación, ejecución, resultados y asistente | `jarvis-reconciliation-agent` | `ReconciliationApiController`, `ReconciliationService`, rutas `/ui/api/reconciliation/**` | **INTEGRACIÓN REAL EN BFF; mayor cobertura funcional detectada** | Es el módulo más acoplado al contrato remoto; un cambio de endpoint rompe múltiples pantallas |
| `silver workflow` | Creación del workflow Bronze→Silver y confirmación de fuente | `silver-refinement-agent` | No hay cliente/configuración dedicada en este frontend | **SIN INTEGRACIÓN EN ESTE REPOSITORIO** | Riesgo de seguir construyendo Silver fuera del frontend oficial |
| `business rules / mapping` | Draft y versionado de reglas de refinamiento Silver | `silver-refinement-agent` | No hay cliente/configuración dedicada | **SIN INTEGRACIÓN EN ESTE REPOSITORIO** | Posible confusión con `qualityrules`, que es otro bounded context |
| `silver execution` | Ejecución y consulta de refinamiento Silver | `silver-refinement-agent` | No hay evidencia en el frontend actual | **SIN INTEGRACIÓN** | La experiencia unificada todavía está incompleta |
| `governance` | Evidencia, versionado, aprobación y trazabilidad Silver | `silver-refinement-agent` | No hay evidencia en el frontend actual | **SIN INTEGRACIÓN** | Auditoría fragmentada entre backend y UI |
| `agentops` | Observabilidad y métricas del agente Silver | `silver-refinement-agent` | No hay evidencia en el frontend actual | **SIN INTEGRACIÓN** | AgentOps puede quedar aislado en otro frontend accidental |
| `intelligence` | Asistencia contextual | Separar por dominio | Reconciliation ya expone `/reconciliation/ask`; Silver posee su propia inteligencia | **DEBE SEPARARSE POR BACKEND** | Un asistente único sin routing puede mezclar contextos y acciones |

## 4. Inventario de contratos frontend detectados

### 4.1 Profiling

Rutas internas observadas:

```text
GET  /ui/api/profiling/connections
GET  /ui/api/profiling/connections/{connectionId}/datasets
GET  /ui/api/profiling/connections/{connectionId}/datasets/{datasetId}/tables
GET  /ui/api/profiling/metadata/{connectionId}/datasets
GET  /ui/api/profiling/metadata/{connectionId}/{datasetId}/tables
POST /ui/api/profiling/execute
POST /ui/api/profiling/profile
POST /ui/api/profiling/schedules
```

Hallazgo: conviven rutas de experiencia V1 y V2. Debe definirse un contrato canónico y retirar aliases solo después de contract tests.

### 4.2 Quality Rules

Rutas internas observadas:

```text
GET  /ui/api/quality-rules/rule-types
POST /ui/api/quality-rules/suggestions
POST /ui/api/quality-rules/draft
GET  /ui/api/quality-rules/draft/{draftId}
PUT  /ui/api/quality-rules/draft/{draftId}
POST /ui/api/quality-rules/draft/{draftId}/validate
POST /ui/api/quality-rules/draft/{draftId}/confirm
POST /ui/api/quality-rules/schedules
```

Hallazgo crítico: el frontend V2 incluye fallback basado en `sessionStorage` y puede crear identificadores `LOCAL_*` cuando el backend falla. Esta conducta debe clasificarse como **degradación de UX**, no como persistencia válida.

### 4.3 Quality Execution

Rutas internas observadas:

```text
GET  /ui/api/quality-execution/configs?activeOnly=true
POST /ui/api/quality-execution/execute
GET  /ui/api/quality-execution/result/{executionId}
GET  /ui/api/quality-execution/issues/{executionId}
```

### 4.4 Reconciliation

Rutas internas observadas:

```text
GET  /ui/api/reconciliation/configs
POST /ui/api/reconciliation/execute
GET  /ui/api/reconciliation/result/{executionId}
GET  /ui/api/reconciliation/latest/{reconciliationId}
POST /ui/api/reconciliation/ask
GET  /ui/api/reconciliation/connections
GET  /ui/api/reconciliation/metadata/{connectionId}/datasets
GET  /ui/api/reconciliation/metadata/{connectionId}/{datasetId}/tables
POST /ui/api/reconciliation/draft
GET  /ui/api/reconciliation/draft/{draftId}
PUT  /ui/api/reconciliation/draft/{draftId}
POST /ui/api/reconciliation/draft/{draftId}/validate
POST /ui/api/reconciliation/draft/{draftId}/confirm
```

Servicios remotos visibles en código Java:

```text
/reconciliation/configs
/reconciliation/execute
/reconciliation/result/{executionId}
/reconciliation/latest/{reconciliationId}
/reconciliation/ask
/reconciliation/configure/draft
/reconciliation/configure/draft/{draftId}
/reconciliation/configure/validate/{draftId}
/reconciliation/configure/confirm/{draftId}
```

## 5. Clasificación canónica por módulo

| Módulo | Clasificación | Justificación |
|---|---|---|
| Profiling | **REAL / CONTRATO NO CERTIFICADO** | Hay BFF, servicios y DTOs; falta contrastar contra OpenAPI y smoke remoto |
| Quality Rules | **REAL CON FALLBACK LOCAL** | Llama al BFF, pero degrada a reglas locales y drafts `LOCAL_*` ante error |
| Quality Execution | **REAL / CONTRATO NO CERTIFICADO** | Hay BFF y endpoints internos definidos; falta prueba contractual |
| Reconciliation | **REAL / CONTRATO NO CERTIFICADO** | Tiene la integración más completa y múltiples servicios remotos definidos |
| Silver | **SIN INTEGRACIÓN EN EL FRONTEND OFICIAL** | No existe configuración ni cliente dedicado al backend Silver |

No se detectaron mocks Java explícitos como repositorios en memoria. Los `Map.of()` y `List.of()` encontrados corresponden principalmente a payloads vacíos o normalización defensiva; no constituyen por sí solos un backend mock.

## 6. Límites que no deben cruzarse

| Regla | Decisión canónica |
|---|---|
| El frontend calcula perfiles o métricas finales | **Prohibido**. Solo puede normalizar y presentar respuestas. |
| El fallback local se considera dato persistido | **Prohibido**. Debe mostrarse como estado degradado/no publicado. |
| El frontend persiste reglas directamente | **Prohibido**. Debe usar APIs del backend dueño. |
| `silver-refinement-agent` ejecuta conciliación | **Prohibido**, salvo ADR futuro. |
| `jarvis-reconciliation-agent` administra workflows Bronze→Silver | **Prohibido**. |
| Un mismo caso de uso se implementa en ambos backends | **Prohibido** sin ADR. |
| URLs Cloud Run hardcodeadas como default productivo | **Deuda crítica**. Deben venir de variable obligatoria por ambiente. |
| DTOs compartidos entre ambos backends | **Evitar**. Mantener bounded contexts separados. |

## 7. Diseño objetivo de integración

```text
src/main/java/com/kyndryl/dataops/platform/integration/
├── reconciliation/
│   ├── ReconciliationBackendClient
│   ├── ProfilingClient
│   ├── QualityRulesClient
│   ├── QualityExecutionClient
│   └── dto/
└── silver/
    ├── SilverWorkflowClient
    ├── SilverExecutionClient
    ├── SilverGovernanceClient
    ├── SilverAgentOpsClient
    └── dto/
```

Configuración objetivo:

```yaml
backends:
  reconciliation:
    base-url: ${RECONCILIATION_BACKEND_BASE_URL}
  silver:
    base-url: ${SILVER_BACKEND_BASE_URL}
```

La variable única `DATAOPS_API_URL` debe migrarse de manera compatible y controlada; no debe eliminarse hasta tener pruebas de regresión.

## 8. Criterios de verificación de contrato

Para cambiar una fila a **VERIFICADA**, se requiere:

1. repositorio backend exacto;
2. URL por ambiente;
3. OpenAPI o código backend;
4. endpoint y método HTTP;
5. request DTO;
6. response DTO;
7. autenticación;
8. timeout, retries e idempotencia;
9. contract test;
10. smoke contra ambiente real;
11. owner técnico.

## 9. Inventario crítico actualizado

| Pendiente | Estado | Prioridad |
|---|---|---|
| Confirmar repositorio exacto de `jarvis-reconciliation-agent` | Pendiente | P0 |
| Extraer OpenAPI remoto de profiling, quality y reconciliation | Pendiente | P0 |
| Inventariar controladores, servicios y rutas frontend | **Completado** | P0 |
| Confirmar URL/configuración actual | **Completado** | P0 |
| Clasificar mocks y fallbacks | **Completado parcialmente** | P0 |
| Ejecutar contract smoke frontend→backend | Pendiente | P0 |
| Introducir segunda configuración para Silver | Pendiente | P1 |
| Separar clientes HTTP por bounded context | Pendiente | P1 |
| Eliminar fallback silencioso de persistencia | Pendiente | P1 |
| Definir contract tests por backend | Pendiente | P1 |

## 10. Gate de avance

Antes de agregar nuevas pantallas o automatizaciones de integración:

1. certificar los contratos reales de `jarvis-reconciliation-agent`;
2. probar al menos un happy path por módulo;
3. registrar incompatibilidades entre UI V1/V2;
4. definir la integración del backend Silver en el frontend oficial;
5. prohibir que un fallback local sea presentado como publicación exitosa.
