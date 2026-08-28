# Sprint A — Hallazgos certificados del contrato

> Estado: **COMPLETADO**  
> Backend evaluado: `jarvis-reconciliation-agent`  
> Fuente: OpenAPI 3.1.0 publicado por Cloud Run  
> Endpoints reales: 36

## 1. Resumen ejecutivo

El backend ya soporta una base funcional importante para profiling, calidad de datos y reconciliación, pero todavía no expone un CRUD gobernado completo.

Resultado de la certificación:

- `EXISTS`: 19
- `PARTIAL`: 5
- `MISSING`: 9

La conclusión arquitectónica es que **no corresponde reconstruir el backend desde cero**. Debemos preservar los endpoints operativos actuales, incorporar adapters en el BFF para alias funcionales y desarrollar únicamente las capacidades faltantes de ciclo de vida, versionado e historial.

## 2. Hallazgos por dominio

### 2.1 Profiling

Operaciones existentes:

- conexiones;
- datasets;
- tablas;
- columnas;
- ejecución real mediante `POST /data-quality/profile`.

Brecha:

- el frontend espera rutas `/profiling/*`, mientras el backend concentra profiling bajo `/data-quality/profile`.

Decisión:

- corto plazo: adapter BFF en el frontend;
- mediano plazo: definir un contrato canónico único sin duplicar el motor.

### 2.2 Calidad de datos

Operaciones existentes:

- catálogo de tipos de regla;
- crear, consultar y actualizar draft;
- validar y confirmar draft;
- listar configuraciones mediante `/data-quality/configs`;
- consultar detalle mediante `/data-quality/config/{quality_config_id}`;
- ejecutar calidad;
- consultar resultado, incidencias y último resultado.

Operaciones faltantes:

- crear nueva versión de una configuración publicada;
- activar/desactivar;
- archivar lógicamente;
- consultar historial de versiones.

Decisión:

- reutilizar `/data-quality/configs` y `/data-quality/config/{id}` mediante adapter BFF;
- implementar las cuatro capacidades faltantes como primera ampliación real del backend.

### 2.3 Reconciliación

Operaciones existentes:

- listar configuraciones mediante `/reconciliation/configs`;
- crear, consultar y actualizar draft;
- validar y confirmar draft;
- ejecutar reconciliación;
- consultar resultado y último resultado;
- asistencia contextual mediante `/reconciliation/ask`.

Operaciones faltantes:

- detalle directo de configuración publicada;
- nueva versión;
- activar/desactivar;
- archivado lógico;
- historial de versiones.

Decisión:

- preservar `/reconciliation/configs` como endpoint legacy soportado;
- implementar las cinco capacidades faltantes con versionado inmutable y auditoría.

## 3. Primer incremento de implementación

### Incremento B1 — CRUD gobernado mínimo

Backend:

1. Modelo común de lifecycle: `DRAFT | VALIDATED | ACTIVE | INACTIVE | ARCHIVED`.
2. Versionado inmutable de configuraciones publicadas.
3. Auditoría: `created_by`, `updated_by`, `published_by`, timestamps.
4. Concurrencia optimista mediante `expected_version` o `etag`.
5. Endpoints faltantes para calidad:
   - `POST /data-quality/configurations/{id}/versions`
   - `PATCH /data-quality/configurations/{id}/status`
   - `DELETE /data-quality/configurations/{id}`
   - `GET /data-quality/configurations/{id}/versions`
6. Endpoints faltantes para reconciliación:
   - `GET /reconciliation/configurations/{id}`
   - `POST /reconciliation/configurations/{id}/versions`
   - `PATCH /reconciliation/configurations/{id}/status`
   - `DELETE /reconciliation/configurations/{id}`
   - `GET /reconciliation/configurations/{id}/versions`

Frontend BFF:

1. Adapter `/ui/api/profiling/profile` → `/data-quality/profile`.
2. Adapter de listado y detalle de calidad hacia endpoints legacy actuales.
3. Adapter de listado de reconciliación hacia `/reconciliation/configs`.
4. Eliminar falsos éxitos `LOCAL_*` para publicación.

## 4. Dependencia crítica

El repositorio fuente del backend `jarvis-reconciliation-agent` no aparece entre los repositorios GitHub accesibles actualmente. Por tanto:

- la arquitectura y backlog pueden cerrarse;
- el desarrollo backend no debe comenzar hasta identificar el repositorio fuente correcto o importarlo a GitHub;
- no se deben modificar endpoints desde Cloud Shell fuera de control de versiones.

## 5. Gate para Sprint B

Sprint B puede comenzar cuando se cumplan ambos puntos:

1. repositorio fuente del backend identificado y accesible;
2. estrategia de persistencia/versionado confirmada en el código real.

Mientras tanto, sí puede avanzarse con el adapter BFF del frontend, pero únicamente sobre una rama limpia y después de consolidar los cambios locales V2 existentes.
