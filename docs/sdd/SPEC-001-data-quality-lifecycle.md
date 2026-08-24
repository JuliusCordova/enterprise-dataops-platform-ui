# SPEC-001 — Data Profiling & Quality Lifecycle

**Estado:** REVIEWED  
**Dominio:** Data Quality  
**Frontend/BFF:** `enterprise-dataops-platform-ui`  
**Backend ejecutable:** `JuliusCordova/intercorp-fest-agent`

## 1. Problema

Los equipos necesitan validar rápidamente la condición de una tabla, tanto sobre datos actuales como sobre periodos históricos, convertir los hallazgos en reglas de calidad gobernadas y ejecutar esas reglas de forma repetible sin escribir lógica ad hoc en cada análisis.

## 2. Outcome

Permitir que un usuario complete el siguiente ciclo:

`Seleccionar fuente → Perfilar → Entender hallazgos → Crear reglas → Validar → Publicar/versionar → Ejecutar → Observar resultados`

La ejecución deberá soportar dos modos:

- `ON_DEMAND`;
- `SCHEDULED`.

## 3. Alcance funcional

### 3.1 Descubrimiento

El usuario selecciona:

- conexión;
- proyecto/dataset;
- tabla;
- columnas opcionales;
- clave de negocio opcional;
- columna de fecha opcional;
- filtro de negocio opcional.

### 3.2 Perfilamiento

El sistema debe producir como mínimo:

- conteo de filas;
- tipo de dato;
- nulos y porcentaje de nulos;
- cardinalidad/distintos;
- mínimo, máximo, promedio y desviación estándar para numéricos;
- metadata suficiente para soportar diseño de reglas.

#### Perfil actual

Ejecuta sobre el estado vigente de la tabla.

#### Perfil histórico

Debe permitir repetir el perfil sobre una ventana o corte histórico mediante uno de estos patrones, según la fuente:

- `business_date` + `date_column`;
- rango `from/to`;
- filtro gobernado;
- snapshot/time-travel cuando la tecnología lo permita.

El corte utilizado debe persistirse junto con el resultado para permitir comparación y auditoría.

## 4. Diseño de reglas de calidad

A partir del perfil, el usuario podrá crear reglas manualmente o desde sugerencias. Toda sugerencia debe ser editable y debe pasar por validación antes de publicarse.

Una regla debe incluir como mínimo:

- nombre;
- dimensión de calidad;
- tipo de regla;
- columna o columnas afectadas;
- parámetros;
- umbral warning;
- umbral critical;
- severidad;
- estado activo/inactivo.

Ejemplos de tipos: completitud, unicidad, dominio permitido, rango, patrón, comparación entre columnas, integridad de clave y consistencia temporal.

## 5. Ciclo de vida de configuración

Estados de configuración:

`DRAFT → ACTIVE ↔ INACTIVE → ARCHIVED`

Estados de versión:

`DRAFT → PUBLISHED → SUPERSEDED`

Reglas:

1. una configuración publicada es inmutable;
2. una modificación de una configuración publicada genera nueva versión;
3. una ejecución registra la versión exacta utilizada;
4. el archivado es lógico;
5. el historial no se elimina.

## 6. Ejecución

### 6.1 On-demand

El usuario selecciona una configuración `ACTIVE`, opcionalmente un `business_date`, y solicita una ejecución inmediata.

La ejecución debe generar:

- `execution_id`;
- configuration/version ID;
- timestamps;
- modo de ejecución;
- estado;
- métricas por regla;
- issues/incumplimientos;
- resumen global;
- evidencia de error cuando corresponda.

### 6.2 Programada

Una configuración podrá asociarse a una programación versionada que incluya:

- frecuencia/cron;
- timezone;
- fecha de inicio;
- estado enabled/disabled;
- parámetros de fecha de negocio;
- política de reintentos;
- owner.

El scheduler no debe contener la lógica de calidad; únicamente dispara la misma operación de ejecución utilizada por `ON_DEMAND`.

## 7. Contratos principales

Backend revisado actualmente:

- `POST /data-quality/profile`
- `GET /data-quality/rule-types`
- `POST /data-quality/configure/draft`
- `GET /data-quality/configure/draft/{draft_id}`
- `PUT /data-quality/configure/draft/{draft_id}`
- `POST /data-quality/configure/validate/{draft_id}`
- `POST /data-quality/configure/confirm/{draft_id}`
- `POST /data-quality/execute`
- `GET /data-quality/result/{execution_id}`
- `GET /data-quality/latest/{quality_config_id}`
- CRUD canónico bajo `/data-quality/configurations*`.

El BFF debe exponer rutas estables propias y encapsular diferencias legacy/canónicas.

## 8. Criterios de aceptación

### AC-DQ-01 — Perfil actual

Dada una tabla BigQuery válida, cuando el usuario solicita perfilamiento, entonces recibe métricas reales calculadas sobre la tabla seleccionada y no valores simulados en frontend.

### AC-DQ-02 — Perfil histórico

Dada una tabla con columna temporal y un corte histórico, cuando el usuario solicita perfilamiento para ese corte, entonces todas las métricas corresponden exclusivamente al periodo solicitado y el corte queda trazado en el resultado.

### AC-DQ-03 — Regla gobernada

Una regla no puede publicarse sin pasar validación de estructura, referencias, parámetros y compatibilidad con la tabla/columnas seleccionadas.

### AC-DQ-04 — Publicación/versionado

Publicar una configuración crea una versión inmutable; modificarla posteriormente crea una nueva versión y conserva la anterior.

### AC-DQ-05 — On-demand

Una configuración `ACTIVE` puede ejecutarse a demanda y devuelve `execution_id`, estado, métricas e issues.

### AC-DQ-06 — Scheduled

Una programación habilitada dispara la misma ejecución gobernada, registra `execution_mode=SCHEDULED` y conserva trazabilidad del schedule que la originó.

### AC-DQ-07 — Auditoría

Para cualquier ejecución debe poder reconstruirse quién/qué la disparó, configuración y versión, fuente, corte de datos, resultado y evidencia técnica.

## 9. Cobertura actual

| Capacidad | Estado |
|---|---|
| Selección de conexión/dataset/tabla | IMPLEMENTED / TO_VALIDATE runtime |
| Perfil actual BigQuery | IMPLEMENTED |
| Perfil histórico parametrizado | GAP |
| Draft y validación de reglas | IMPLEMENTED |
| CRUD/versionado/publicación canónica | IMPLEMENTED en backend branch |
| Ejecución on-demand | IMPLEMENTED |
| Consulta latest/result | IMPLEMENTED |
| Scheduling persistente | GAP |
| Trazabilidad frontend ↔ backend ↔ release | PARTIAL |

## 10. Fuera de alcance de esta SPEC

- transformación Bronze → Silver;
- generación de pipelines de ingesta;
- corrección automática de datos productivos;
- persistencia duplicada de reglas en frontend.
