# Especificación canónica de CRUD — Calidad y Reconciliación

> Estado: diseño funcional y técnico previo a implementación  
> Frontend dueño: `enterprise-dataops-platform-ui`  
> Backend dueño: `jarvis-reconciliation-agent`

## 1. Objetivo

Permitir que un usuario administre configuraciones de **calidad de datos** y **reconciliación** como entidades de negocio persistentes, con operaciones completas de creación, consulta, edición, activación/desactivación y retiro controlado.

El CRUD no debe limitarse a borradores. Una configuración confirmada debe poder consultarse, versionarse, editarse mediante nueva versión y desactivarse sin perder trazabilidad.

## 2. Principios

1. El frontend actúa como BFF y experiencia de usuario; no persiste configuraciones localmente.
2. El backend mantiene la fuente de verdad, validaciones, versiones y auditoría.
3. No se elimina físicamente una configuración usada por ejecuciones históricas.
4. `DELETE` significa retiro lógico o archivado, salvo que el registro nunca haya sido publicado ni ejecutado.
5. Toda modificación publicada crea una nueva versión inmutable.
6. Las ejecuciones deben guardar la versión exacta de la configuración utilizada.
7. No se aceptan identificadores `LOCAL_*` como configuraciones publicadas.

## 3. Entidades

### 3.1 Data Quality Configuration

Campos mínimos:

- `quality_config_id`
- `version`
- `name`
- `description`
- `connection_id`
- `dataset_id`
- `table_id`
- `rules[]`
- `execution_mode`
- `schedule`
- `owner`
- `status`: `DRAFT | ACTIVE | INACTIVE | ARCHIVED`
- `created_at`, `created_by`
- `updated_at`, `updated_by`
- `published_at`, `published_by`
- `etag` o `expected_version`

### 3.2 Reconciliation Configuration

Campos mínimos:

- `reconciliation_id`
- `version`
- `process_name`
- `description`
- fuente y destino
- claves de negocio
- columnas de conteo
- columnas de suma
- tolerancias
- reglas de matching
- frecuencia o modo de ejecución
- `owner`
- `status`: `DRAFT | ACTIVE | INACTIVE | ARCHIVED`
- metadatos de auditoría
- `etag` o `expected_version`

## 4. Contrato CRUD requerido

### 4.1 Calidad de datos

| Operación | Método | Endpoint canónico | Observación |
|---|---|---|---|
| Crear borrador | `POST` | `/data-quality/configurations` | Devuelve ID y versión 1 |
| Listar configuraciones | `GET` | `/data-quality/configurations` | Filtros por estado, dominio, dataset, tabla y owner |
| Consultar configuración | `GET` | `/data-quality/configurations/{id}` | Devuelve versión activa o indicada |
| Consultar versión | `GET` | `/data-quality/configurations/{id}/versions/{version}` | Inmutable |
| Editar borrador | `PUT` | `/data-quality/configurations/{id}` | Requiere `expected_version` |
| Publicar | `POST` | `/data-quality/configurations/{id}/publish` | Cambia a ACTIVE |
| Crear nueva versión | `POST` | `/data-quality/configurations/{id}/versions` | Parte de una versión publicada |
| Activar/desactivar | `PATCH` | `/data-quality/configurations/{id}/status` | No elimina historial |
| Archivar | `DELETE` | `/data-quality/configurations/{id}` | Borrado lógico |
| Historial | `GET` | `/data-quality/configurations/{id}/versions` | Auditoría completa |

### 4.2 Reconciliación

| Operación | Método | Endpoint canónico | Observación |
|---|---|---|---|
| Crear borrador | `POST` | `/reconciliation/configurations` | Devuelve ID y versión 1 |
| Listar configuraciones | `GET` | `/reconciliation/configurations` | Filtros por estado, dominio y owner |
| Consultar configuración | `GET` | `/reconciliation/configurations/{id}` | Incluye fuente, destino y reglas |
| Consultar versión | `GET` | `/reconciliation/configurations/{id}/versions/{version}` | Inmutable |
| Editar borrador | `PUT` | `/reconciliation/configurations/{id}` | Requiere `expected_version` |
| Validar | `POST` | `/reconciliation/configurations/{id}/validate` | No publica |
| Publicar | `POST` | `/reconciliation/configurations/{id}/publish` | Cambia a ACTIVE |
| Crear nueva versión | `POST` | `/reconciliation/configurations/{id}/versions` | Copia controlada |
| Activar/desactivar | `PATCH` | `/reconciliation/configurations/{id}/status` | Mantiene historial |
| Archivar | `DELETE` | `/reconciliation/configurations/{id}` | Borrado lógico |
| Historial | `GET` | `/reconciliation/configurations/{id}/versions` | Auditoría completa |

## 5. Estado actual detectado

### Reconciliación

El frontend ya implementa:

- listar configuraciones;
- crear borrador;
- consultar borrador;
- actualizar borrador;
- validar;
- confirmar/publicar;
- ejecutar y consultar resultados.

Brechas:

- no existe edición explícita de una configuración ya publicada;
- no existe nueva versión controlada;
- no existe activación/desactivación;
- no existe archivado lógico;
- no existe historial de versiones;
- `GET /reconciliation/configs` debe alinearse al contrato canónico.

### Calidad de datos

El frontend ya implementa:

- catálogo de tipos de regla;
- crear borrador;
- consultar borrador;
- actualizar borrador;
- validar;
- confirmar/publicar.

Brechas:

- no existe listado CRUD completo de configuraciones publicadas;
- no existe consulta por ID de configuración publicada;
- no existe edición/versionado después de publicar;
- no existe activar/desactivar;
- no existe archivado lógico;
- no existe historial;
- el fallback `LOCAL_*` puede simular persistencia y debe quedar claramente marcado como no publicado.

## 6. Experiencia de usuario requerida

Cada módulo tendrá una vista de administración con:

- buscador;
- filtros por estado, dominio, dataset/tabla y owner;
- tabla o cards con última versión y estado;
- acciones: Ver, Editar, Duplicar, Activar/Desactivar, Archivar;
- historial de versiones;
- confirmación explícita antes de archivar;
- bloqueo de edición directa sobre versiones publicadas;
- creación automática de nueva versión al editar una configuración ACTIVE.

## 7. Controles obligatorios

- control optimista con `etag` o `expected_version`;
- idempotency key para creación y publicación;
- auditoría de usuario y timestamp;
- validación de referencias a conexión/dataset/tabla;
- no archivar una configuración con ejecución activa;
- no borrar evidencia histórica;
- contract tests frontend↔backend;
- smoke de create, read, update, publish, deactivate y archive.

## 8. Prioridad de implementación

### P0

1. Certificar OpenAPI real del backend.
2. Alinear endpoints actuales con el contrato canónico.
3. Implementar listado y detalle de configuraciones publicadas.
4. Implementar edición mediante nueva versión.
5. Implementar activar/desactivar.

### P1

1. Archivado lógico.
2. Historial visual de versiones.
3. Duplicación de configuración.
4. Filtros avanzados y paginación.
5. Contract tests automatizados.

## 9. Gate de aceptación

No se considera CRUD completo hasta demostrar para ambos dominios:

`Create → Read → Update as new version → Publish → Deactivate → Reactivate → Archive → Historical read`
