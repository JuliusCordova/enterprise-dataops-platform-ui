# Modelo de dominio y persistencia para configuraciones

**Estado:** DRAFT  
**Sprint:** D — Preparar CRUD backend de calidad y reconciliación  
**Fuente de verdad:** `enterprise-dataops-platform-ui`

## 1. Objetivo

Definir un modelo común para administrar configuraciones de calidad y reconciliación con versionado, publicación, activación, desactivación, archivado e historial, sin alterar contratos legacy existentes hasta completar la migración.

## 2. Agregados de dominio

### 2.1 Configuration

Representa la identidad estable de una configuración a lo largo del tiempo.

Campos mínimos:

| Campo | Tipo lógico | Regla |
|---|---|---|
| `configuration_id` | UUID/string | Identificador estable e inmutable |
| `configuration_type` | enum | `QUALITY` o `RECONCILIATION` |
| `name` | string | Nombre funcional |
| `description` | string nullable | Descripción ejecutiva o técnica |
| `status` | enum | `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `current_version` | integer | Última versión creada |
| `active_version` | integer nullable | Versión publicada actualmente |
| `created_at` | timestamp | Auditoría |
| `created_by` | string | Auditoría |
| `updated_at` | timestamp | Auditoría |
| `updated_by` | string | Auditoría |
| `archived_at` | timestamp nullable | Soft delete |
| `archived_by` | string nullable | Soft delete |

### 2.2 ConfigurationVersion

Contiene el payload funcional versionado.

| Campo | Tipo lógico | Regla |
|---|---|---|
| `configuration_id` | FK | Referencia a `Configuration` |
| `version_number` | integer | Secuencial por configuración |
| `version_status` | enum | `DRAFT`, `PUBLISHED`, `SUPERSEDED`, `ARCHIVED` |
| `payload` | JSON/JSONB | Definición completa del dominio |
| `validation_status` | enum | `NOT_VALIDATED`, `VALID`, `INVALID` |
| `validation_result` | JSON nullable | Errores y advertencias |
| `created_at` | timestamp | Auditoría |
| `created_by` | string | Auditoría |
| `published_at` | timestamp nullable | Auditoría |
| `published_by` | string nullable | Auditoría |

Clave primaria propuesta: `(configuration_id, version_number)`.

## 3. Payload por dominio

### 3.1 Quality configuration payload

Debe conservar, como mínimo:

- conexión, dataset y tabla;
- reglas configuradas;
- parámetros y umbrales;
- severidad;
- dimensiones de calidad;
- metadatos de ejecución aplicables.

### 3.2 Reconciliation configuration payload

Debe conservar, como mínimo:

- origen y destino;
- datasets y tablas;
- claves de comparación;
- métricas configuradas;
- tolerancias;
- filtros y fecha de negocio;
- parámetros de ejecución.

Los DTOs específicos de cada dominio no deben mezclarse ni heredarse indiscriminadamente.

## 4. Máquina de estados

### Configuration

```text
DRAFT ──publish──> ACTIVE
ACTIVE ──deactivate──> INACTIVE
INACTIVE ──activate──> ACTIVE
DRAFT|ACTIVE|INACTIVE ──archive──> ARCHIVED
```

Reglas:

1. Solo una versión puede estar activa por configuración.
2. Editar una configuración `ACTIVE` no modifica la versión publicada.
3. La edición de una configuración `ACTIVE` crea una nueva versión `DRAFT`.
4. Publicar la nueva versión marca la versión activa anterior como `SUPERSEDED`.
5. `DELETE` se implementa como archivado lógico.
6. Una configuración `ARCHIVED` no puede ejecutarse ni modificarse.

## 5. Flujo de versionado

```text
ACTIVE v3
   │
   └── Editar
         ↓
      DRAFT v4
         │
         ├── Validar
         │     ├── INVALID → corregir
         │     └── VALID
         ↓
      Publicar
         ↓
      ACTIVE v4 + SUPERSEDED v3
```

## 6. Persistencia propuesta

Modelo relacional recomendado:

```text
configuration
configuration_version
configuration_audit_event
```

### configuration_audit_event

Registra acciones de negocio:

- `CREATED`
- `UPDATED`
- `VALIDATED`
- `PUBLISHED`
- `ACTIVATED`
- `DEACTIVATED`
- `ARCHIVED`
- `VERSION_CREATED`

Campos mínimos: `event_id`, `configuration_id`, `version_number`, `event_type`, `actor`, `occurred_at`, `details`.

## 7. Concurrencia e idempotencia

- Usar `updated_at` o `row_version` para control optimista.
- Rechazar actualizaciones sobre una versión desactualizada con `409 Conflict`.
- Publicación y cambio de estado deben ser transaccionales.
- Las operaciones de creación deben admitir `Idempotency-Key` cuando el backend lo implemente.

## 8. Compatibilidad legacy

Durante la transición:

- las rutas legacy de drafts continúan operativas;
- los adapters BFF encapsulan las rutas reales;
- las rutas canónicas se agregan sin reutilizar semánticas ambiguas;
- no se elimina una ruta legacy hasta contar con telemetría, pruebas y ventana de migración.

## 9. Criterios de aceptación del modelo

- identidad estable independiente de la versión;
- historial completo y consultable;
- publicación sin mutación de versiones activas;
- soft delete auditable;
- aislamiento de DTOs por dominio;
- compatibilidad con contratos legacy certificados;
- ausencia de lógica de persistencia o versionado en frontend.

## 10. Próximos artefactos

1. OpenAPI propuesto para calidad.
2. OpenAPI propuesto para reconciliación.
3. Matriz endpoint canónico ↔ endpoint legacy.
4. Backlog backend por endpoint y entidad.
5. Criterios de pruebas unitarias, integración, contrato y migración.
