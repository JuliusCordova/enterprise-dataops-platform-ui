# Matriz canónica Frontend → Backend

> Estado: **baseline de arquitectura en validación**  
> Repositorio dueño: `JuliusCordova/enterprise-dataops-platform-ui`  
> Objetivo: evitar duplicidad de lógica, integraciones cruzadas y ownership ambiguo entre backends.

## 1. Verdades arquitectónicas

1. `enterprise-dataops-platform-ui` es el **frontend único** de la plataforma.
2. El frontend no implementa lógica de negocio de calidad, perfilamiento, reconciliación ni refinamiento Silver.
3. Cada módulo debe consumir un backend dueño mediante cliente HTTP/BFF.
4. `jarvis-reconciliation-agent` es dueño de perfilamiento, calidad y reconciliación.
5. `silver-refinement-agent` es dueño del flujo Bronze→Silver, reglas/mapeos de refinamiento, ejecución Silver, gobierno operativo y AgentOps del flujo Silver.
6. Los endpoints exactos se consideran **verificados** solo cuando existen en OpenAPI o en el código del backend correspondiente.

## 2. Matriz de routing funcional

| Módulo frontend | Capacidad de negocio | Backend dueño | Contrato esperado | Estado | Riesgo si se enruta mal |
|---|---|---|---|---|---|
| `profiling` | Descubrimiento de estructura, estadísticas, nulos, cardinalidad, distribución y anomalías de columnas | `jarvis-reconciliation-agent` | APIs de profiling / datasets / columns / results | **Asignación confirmada; endpoints por verificar** | Duplicidad de profiling o cálculos inconsistentes |
| `qualityrules` | Definición, edición, validación y catálogo de reglas de calidad | `jarvis-reconciliation-agent` | APIs de quality rules / rule catalog / validation | **Asignación confirmada; endpoints por verificar** | Reglas divergentes entre calidad y Silver |
| `qualityexecution` | Lanzamiento, seguimiento y resultados de ejecuciones de calidad | `jarvis-reconciliation-agent` | APIs de quality execution / runs / metrics / incidents | **Asignación confirmada; endpoints por verificar** | Ejecuciones duplicadas o métricas no comparables |
| `reconciliation` | Configuración de conciliaciones, comparación origen-destino, diferencias y evidencias | `jarvis-reconciliation-agent` | APIs de reconciliation / matching / differences / evidence | **Asignación confirmada; endpoints por verificar** | Pérdida de trazabilidad y doble motor de conciliación |
| `silver workflow` | Creación del workflow Bronze→Silver, selección de fuente y contexto de esquema | `silver-refinement-agent` | OpenAPI Silver Workflow (`create`, `confirm source`) | **Backend confirmado; endpoints existentes en OpenAPI** | Frontend podría reimplementar flujo o persistencia |
| `business rules / mapping` | Draft y versionado de reglas de transformación/refinamiento Silver | `silver-refinement-agent` | OpenAPI Silver Workflow (`save draft`, versiones) | **Backend confirmado; endpoints existentes en OpenAPI** | Confusión entre reglas de calidad y reglas de refinamiento |
| `silver execution` | Ejecución del refinamiento Silver y consulta de estados/resultados | `silver-refinement-agent` | APIs de execution / status / outputs | **Asignación confirmada; endpoints por inventariar** | Lanzamiento en backend incorrecto o estados desalineados |
| `governance` | Evidencia, versionado, aprobación y trazabilidad del workflow Silver | `silver-refinement-agent` | APIs de workflow history / approvals / evidence | **Asignación confirmada; endpoints por inventariar** | Auditoría fragmentada |
| `agentops` | Observabilidad, trazas, calidad operativa y métricas de agentes Silver | `silver-refinement-agent` | APIs de AgentOps / traces / metrics / evaluations | **Asignación confirmada; endpoints por inventariar** | Métricas mezcladas con calidad de datos |
| `intelligence` | Recomendaciones y asistencia contextual sobre el flujo Silver | `silver-refinement-agent` | APIs de recommendation / ask / insights | **Asignación preliminar; validar alcance** | Acoplamiento con dominios de calidad/reconciliación |

## 3. Límites que no deben cruzarse

| Regla | Decisión canónica |
|---|---|
| El frontend calcula perfiles o métricas | **Prohibido**. Solo presenta resultados del backend dueño. |
| El frontend persiste reglas de negocio directamente | **Prohibido**. Debe usar APIs del backend dueño. |
| `silver-refinement-agent` ejecuta conciliación | **Prohibido**, salvo contrato explícito futuro aprobado. |
| `jarvis-reconciliation-agent` administra workflows Bronze→Silver | **Prohibido**. |
| Un mismo caso de uso se implementa en ambos backends | **Prohibido** sin ADR y decisión explícita. |
| URLs Cloud Run hardcodeadas en controladores o templates | **Prohibido**. Deben venir de configuración por ambiente. |
| DTOs frontend compartidos entre backends sin separación | **Evitar**. Usar paquetes/clientes por bounded context. |

## 4. Diseño recomendado de clientes en el frontend

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

Configuración esperada:

```yaml
backends:
  reconciliation:
    base-url: ${RECONCILIATION_BACKEND_BASE_URL}
  silver:
    base-url: ${SILVER_BACKEND_BASE_URL}
```

## 5. Criterios de verificación

Para cambiar una fila de **por verificar** a **verificada**, se requiere:

1. Nombre real del repositorio backend.
2. URL de servicio por ambiente.
3. Endpoint y método HTTP.
4. Request DTO.
5. Response DTO.
6. Mecanismo de autenticación.
7. Timeout, retries e idempotencia.
8. Evidencia de prueba contract/smoke.
9. Owner técnico.

## 6. Inventario pendiente crítico

| Pendiente | Owner | Prioridad |
|---|---|---|
| Confirmar nombre exacto y acceso al repositorio de `jarvis-reconciliation-agent` | Arquitectura | P0 |
| Extraer OpenAPI de calidad, profiling y reconciliación | Backend Reconciliation | P0 |
| Inventariar controladores y clientes HTTP actuales del frontend | Frontend | P0 |
| Confirmar si existen URLs hardcodeadas o mocks | Frontend | P0 |
| Separar DTOs por bounded context | Frontend | P1 |
| Definir contract tests por backend | Delivery Automation | P1 |
| Documentar autenticación frontend→backend | Seguridad/Arquitectura | P1 |

## 7. Regla de avance

No se agregan nuevas pantallas ni automatizaciones de integración hasta completar el inventario P0 y confirmar el routing real de cada módulo.
