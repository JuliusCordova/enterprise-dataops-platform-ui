# SPEC-002 — Reconciliation / Cuadratura Lifecycle

**Estado:** REVIEWED  
**Dominio:** Reconciliation  
**Frontend/BFF:** `enterprise-dataops-platform-ui`  
**Backend ejecutable:** `JuliusCordova/intercorp-fest-agent`

## 1. Problema

Los equipos necesitan comprobar rápidamente que los datos de un origen y un destino cuadran después de una carga, transformación o proceso de negocio, evitando scripts manuales no versionados y dejando evidencia repetible de la comparación.

## 2. Outcome

Permitir el ciclo:

`Seleccionar origen/destino → Definir comparación → Validar → Publicar/versionar → Ejecutar → Analizar diferencias`

La ejecución deberá soportar:

- `ON_DEMAND`;
- `SCHEDULED`.

## 3. Selección de activos

El usuario debe poder navegar metadata de conexiones y seleccionar para ambos lados:

- `connection_id`;
- proyecto/base cuando corresponda;
- dataset/schema;
- tabla;
- columnas.

El BFF no inventa metadata y no permite publicar referencias inexistentes.

## 4. Definición de cuadratura

Una configuración debe permitir como mínimo:

- nombre y descripción;
- dominio/owner;
- activo origen;
- activo destino;
- clave(s) de negocio;
- columna de fecha de negocio;
- columnas de conteo;
- columnas/expresiones agregables;
- filtros de origen y destino;
- tolerancia de filas;
- tolerancias por métrica;
- reglas de matching;
- parámetros de ejecución.

## 5. Validación previa a publicación

La validación debe comprobar:

- existencia de origen y destino;
- existencia y compatibilidad de columnas;
- claves de negocio válidas;
- expresiones/filtros permitidos;
- tolerancias coherentes;
- ausencia de referencias inseguras o no autorizadas;
- payload completo para poder ejecutar.

Validar no equivale a publicar.

## 6. Ciclo de vida

Estados de configuración:

`DRAFT → ACTIVE ↔ INACTIVE → ARCHIVED`

Estados de versión:

`DRAFT → VALID → PUBLISHED → SUPERSEDED`

Reglas:

1. la versión publicada es inmutable;
2. editar una configuración publicada genera nueva versión;
3. solo una versión publicada vigente puede ser la activa;
4. cada ejecución referencia configuración y versión exactas;
5. archivar no borra ejecución ni evidencia histórica.

## 7. Ejecución

### 7.1 On-demand

El usuario elige una reconciliación `ACTIVE` y un `business_date` o parámetros equivalentes.

La ejecución debe devolver como mínimo:

- `execution_id`;
- reconciliation/configuration ID y versión;
- corte de negocio;
- conteo origen;
- conteo destino;
- diferencia de conteos;
- métricas agregadas origen/destino;
- diferencias por métrica;
- tolerancias aplicadas;
- estado final (`CONFORME`, `OBSERVADO`, `CRITICO` o contrato equivalente);
- timestamps y evidencia de error.

### 7.2 Programada

La configuración podrá asociarse a un schedule versionado con frecuencia/cron, timezone, parámetros de fecha, reintentos y owner.

El scheduler debe invocar el mismo contrato de ejecución que `ON_DEMAND`; no se aceptará un segundo motor de reconciliación para ejecución programada.

## 8. Contratos encontrados

El backend operativo contiene contratos legacy para:

- `POST /reconciliation/execute`;
- resultados/latest;
- metadata y catálogo;
- interacción `ask`.

El backend canónico versionado contiene:

- `POST /reconciliation/configurations`;
- `GET /reconciliation/configurations`;
- `GET /reconciliation/configurations/{configuration_id}`;
- `PUT /reconciliation/configurations/{configuration_id}`;
- `DELETE /reconciliation/configurations/{configuration_id}`;
- `POST /reconciliation/configurations/{configuration_id}/validate`;
- `POST /reconciliation/configurations/{configuration_id}/publish`;
- `GET /reconciliation/configurations/{configuration_id}/versions`;
- `POST /reconciliation/configurations/{configuration_id}/versions`;
- `PATCH /reconciliation/configurations/{configuration_id}/status`.

Objetivo técnico: converger el runtime para que ejecución y lifecycle consuman la misma entidad/version canónica.

## 9. Criterios de aceptación

### AC-REC-01 — Configuración

El usuario puede definir origen, destino, claves, métricas, filtros y tolerancias mediante un flujo guiado sin escribir código.

### AC-REC-02 — Validación

No se puede publicar una configuración con activos/columnas inválidos o parámetros insuficientes.

### AC-REC-03 — Publicación/versionado

Una publicación produce versión inmutable; cualquier cambio posterior crea una nueva versión conservando historial.

### AC-REC-04 — On-demand

Una configuración `ACTIVE` puede ejecutarse a demanda para un corte de negocio y produce evidencia reproducible de origen, destino y diferencias.

### AC-REC-05 — Scheduled

Una programación habilitada dispara el mismo contrato de ejecución y registra el schedule y la versión usados.

### AC-REC-06 — Tolerancias

El resultado debe indicar qué tolerancia provocó `CONFORME`, `OBSERVADO` o `CRITICO`; el frontend no recalcula el estado.

### AC-REC-07 — Auditoría

Toda ejecución permite reconstruir configuración/version, usuario o scheduler, fecha de negocio, métricas, resultado y timestamps.

## 10. Cobertura actual

| Capacidad | Estado |
|---|---|
| Navegación metadata origen/destino | IMPLEMENTED / TO_VALIDATE runtime |
| Wizard de configuración | IMPLEMENTED en frontend V2 branch |
| CRUD canónico | IMPLEMENTED en backend branch |
| Validación/publicación/versionado | IMPLEMENTED en backend branch |
| Ejecución on-demand | IMPLEMENTED en backend operativo |
| Resultado/latest | IMPLEMENTED en backend operativo |
| Convergencia ejecución ↔ versión canónica | PARTIAL |
| Scheduling persistente | GAP |
| Evidencia E2E del runtime desplegado | TO_VALIDATE |

## 11. Fuera de alcance

- movimiento físico de datos;
- transformación Bronze → Silver;
- corrección automática de diferencias;
- lógica de reconciliación implementada en JavaScript/frontend.
