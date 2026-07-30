# Nuevo orden de ejecución después de la certificación del contrato

> Estado: **aprobado para ejecución**  
> Repositorio fuente de verdad: `JuliusCordova/enterprise-dataops-platform-ui`  
> Issue operativo: `#3 — Sprint B0: Preservar y ordenar cambios locales V2 antes del CRUD`

## 1. Contexto

La certificación del OpenAPI de `jarvis-reconciliation-agent` concluyó con:

- 36 endpoints reales;
- 19 contratos `EXISTS`;
- 5 contratos `PARTIAL` por aliases o paths legacy;
- 9 capacidades `MISSING` asociadas principalmente a versionado, lifecycle, archivado e historial.

La conclusión arquitectónica es que el backend actual debe reutilizarse. No se reconstruirá desde cero.

Antes de implementar adapters BFF o CRUD adicional, existe un riesgo inmediato: la copia local del frontend contiene cambios V2 modificados y no versionados. Esos cambios deben preservarse, clasificarse y consolidarse de manera segura.

## 2. Orden canónico de implementación

### Etapa 0 — Preservación e inventario local

1. Generar inventario reproducible de archivos modificados y no versionados.
2. Separar código fuente real de:
   - `artifacts/`;
   - backups;
   - scripts de instalación de una sola vez;
   - archivos temporales.
3. No ejecutar `git reset`, `git clean`, `git stash` ni borrados.
4. Crear una rama dedicada para preservar el código V2.

### Etapa 1 — Clasificación funcional V1 vs V2

Cada cambio debe clasificarse como:

- `KEEP`: aporta valor y es compatible con la arquitectura.
- `REWORK`: aporta valor, pero requiere ajustes de contrato, seguridad o mantenibilidad.
- `DROP`: duplicado, temporal, peligroso o fuera del diseño canónico.
- `UNKNOWN`: no existe evidencia suficiente.

La comparación debe realizarse por módulo:

- Profiling;
- Quality Rules;
- Quality Execution;
- Reconciliation;
- Layout y tema común;
- Docker / despliegue.

### Etapa 2 — Consolidación segura del frontend

1. Commit por bounded context, nunca un commit masivo.
2. Excluir backups, `artifacts/` y scripts temporales.
3. Ejecutar build del frontend.
4. Ejecutar smoke de navegación y consumo de endpoints existentes.
5. Documentar cualquier fallback local o contrato simulado.

### Etapa 3 — Adapter BFF

Implementar aliases en el BFF para desacoplar la UX de los paths legacy del backend:

- `/ui/api/profiling/**` → `/data-quality/profile` y metadata existente.
- `/ui/api/quality/configurations` → `/data-quality/configs`.
- `/ui/api/quality/configurations/{id}` → `/data-quality/config/{quality_config_id}`.
- `/ui/api/reconciliation/configurations` → `/reconciliation/configs`.

Los adapters no deben simular persistencia ni devolver éxito cuando el backend falla.

### Etapa 4 — CRUD incremental

#### Calidad de datos

Implementar únicamente las capacidades faltantes:

- crear nueva versión;
- activar/desactivar;
- archivar lógicamente;
- consultar historial.

#### Reconciliación

Implementar:

- detalle de configuración publicada;
- crear nueva versión;
- activar/desactivar;
- archivar lógicamente;
- consultar historial.

### Etapa 5 — Hardening

- contract tests;
- pruebas E2E;
- control optimista con `etag` o `expected_version`;
- idempotencia;
- auditoría;
- observabilidad;
- despliegue candidato a 0 %;
- smoke y promoción controlada.

## 3. Reglas de seguridad operativa

- GitHub es la fuente de verdad.
- No se desarrollan nuevos endpoints mientras el código V2 local no esté preservado.
- No se mezclan cambios de arquitectura, UX y despliegue en un solo commit.
- No se versionan backups ni artefactos generados.
- No se despliega desde una copia local con cambios desconocidos.
- No se modifica directamente una configuración `ACTIVE`; se crea una nueva versión `DRAFT`.

## 4. Secuencia de ramas

```text
architecture/backend-routing-matrix
        ↓
preservation/frontend-v2-local
        ↓
feature/bff-contract-adapters
        ↓
feature/quality-crud-lifecycle
        ↓
feature/reconciliation-crud-lifecycle
        ↓
release/frontend-crud-foundation
```

La rama de preservación se crea desde el HEAD documentado de arquitectura y recibe únicamente código local previamente inventariado.

## 5. Gates

### Gate B0

- inventario local completo;
- rama de preservación creada;
- código V2 respaldado en GitHub;
- clasificación KEEP / REWORK / DROP / UNKNOWN;
- build ejecutado.

### Gate B1

- adapters BFF implementados;
- aliases legacy certificados;
- cero falsos éxitos locales;
- smoke contra `jarvis-reconciliation-agent`.

### Gate B2

- CRUD de calidad completo;
- CRUD de reconciliación completo;
- historial y lifecycle demostrados;
- pruebas contract y E2E aprobadas.

## 6. Próxima acción

Ejecutar Sprint B0 con un script de inventario de solo lectura. El resultado debe permitir preservar únicamente el código fuente real y excluir material temporal antes de crear cualquier commit funcional.
