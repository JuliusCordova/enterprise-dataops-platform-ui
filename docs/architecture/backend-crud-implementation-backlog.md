# Backlog técnico backend para CRUD de calidad y reconciliación

## Propósito

Definir el orden de implementación backend para materializar los contratos canónicos documentados en este repositorio, preservando compatibilidad con rutas legacy certificadas.

## Principios

1. La identidad de configuración es estable e independiente de sus versiones.
2. Solo una versión puede estar activa por configuración.
3. Las versiones publicadas son inmutables.
4. `DELETE` se implementa como archivado lógico.
5. Ninguna capacidad ausente se simula en frontend o BFF.
6. Los DTOs de calidad y reconciliación permanecen aislados por dominio.
7. Publicación, cambio de estado y archivado son transaccionales y auditables.

## Fase 1 — Persistencia y dominio

### BCK-001 — Entidad Configuration

Implementar campos mínimos:

- `configuration_id`
- `domain_type`
- `name`
- `description`
- `status`
- `active_version_number`
- `created_by`
- `created_at`
- `updated_by`
- `updated_at`
- `row_version`

Criterios de aceptación:

- identidad estable;
- índice por dominio y estado;
- control optimista;
- no eliminación física.

### BCK-002 — Entidad ConfigurationVersion

Implementar campos mínimos:

- `configuration_id`
- `version_number`
- `version_status`
- `payload_json`
- `validation_status`
- `validation_errors_json`
- `created_by`
- `created_at`
- `published_by`
- `published_at`

Criterios de aceptación:

- unicidad `(configuration_id, version_number)`;
- una única versión `ACTIVE` por configuración;
- versiones `ACTIVE` y `SUPERSEDED` inmutables.

### BCK-003 — Auditoría de negocio

Crear `configuration_audit_event` con eventos:

- `CREATED`
- `UPDATED`
- `VALIDATED`
- `PUBLISHED`
- `ACTIVATED`
- `DEACTIVATED`
- `ARCHIVED`
- `VERSION_CREATED`

Criterios de aceptación:

- cada mutación genera evento;
- actor, fecha, versión y detalles quedan registrados;
- historial consultable por configuración.

## Fase 2 — Servicios de dominio

### BCK-004 — Crear configuración

Implementar creación de identidad + versión 1 `DRAFT`.

Requisitos:

- soporte opcional de `Idempotency-Key`;
- validación de nombre y dominio;
- auditoría `CREATED` y `VERSION_CREATED`.

### BCK-005 — Actualizar configuración

Reglas:

- si la configuración está `DRAFT`, actualizar la versión draft actual;
- si está `ACTIVE`, crear nueva versión `DRAFT`;
- si está `ARCHIVED`, rechazar con `409 Conflict`;
- validar `rowVersion`.

### BCK-006 — Validar versión

Implementar validación específica por dominio.

Calidad:

- reglas;
- columnas;
- parámetros;
- compatibilidad de tipos.

Reconciliación:

- origen y destino;
- claves;
- filtros;
- fecha de negocio;
- parámetros de ejecución.

### BCK-007 — Publicar versión

Reglas transaccionales:

1. requerir versión `VALID`;
2. marcar la activa previa como `SUPERSEDED`;
3. marcar la nueva versión como `ACTIVE`;
4. actualizar `active_version_number`;
5. emitir evento `PUBLISHED`.

### BCK-008 — Cambiar estado

Soportar:

- `ACTIVE → INACTIVE`;
- `INACTIVE → ACTIVE`;
- rechazar transiciones inválidas;
- auditar `ACTIVATED` o `DEACTIVATED`.

### BCK-009 — Archivar configuración

Implementar soft delete:

- estado `ARCHIVED`;
- impedir ejecución y modificación;
- conservar versiones e historial;
- auditar `ARCHIVED`.

## Fase 3 — Endpoints canónicos de calidad

### BCK-010
`POST /data-quality/configurations`

### BCK-011
`GET /data-quality/configurations`

### BCK-012
`GET /data-quality/configurations/{id}`

### BCK-013
`PUT /data-quality/configurations/{id}`

### BCK-014
`POST /data-quality/configurations/{id}/publish`

### BCK-015
`POST /data-quality/configurations/{id}/versions`

### BCK-016
`PATCH /data-quality/configurations/{id}/status`

### BCK-017
`DELETE /data-quality/configurations/{id}`

### BCK-018
`GET /data-quality/configurations/{id}/versions`

Criterios comunes:

- DTOs propios del dominio;
- respuestas alineadas con el OpenAPI propuesto;
- `404` para identidad inexistente;
- `409` para conflicto de versión o transición;
- eventos de auditoría.

## Fase 4 — Endpoints canónicos de reconciliación

### BCK-019
`POST /reconciliation/configurations`

### BCK-020
`GET /reconciliation/configurations`

### BCK-021
`GET /reconciliation/configurations/{id}`

### BCK-022
`PUT /reconciliation/configurations/{id}`

### BCK-023
`POST /reconciliation/configurations/{id}/validate`

### BCK-024
`POST /reconciliation/configurations/{id}/publish`

### BCK-025
`POST /reconciliation/configurations/{id}/versions`

### BCK-026
`PATCH /reconciliation/configurations/{id}/status`

### BCK-027
`DELETE /reconciliation/configurations/{id}`

### BCK-028
`GET /reconciliation/configurations/{id}/versions`

Criterios comunes:

- DTOs propios del dominio;
- solo configuraciones `ACTIVE` ejecutables;
- validación explícita de origen, destino y parámetros;
- respuestas alineadas con el OpenAPI propuesto.

## Fase 5 — Compatibilidad legacy

### BCK-029 — Adaptar creación legacy

Mapear:

- `POST /data-quality/configure/draft`
- `POST /reconciliation/configure/draft`

hacia creación de identidad + versión `DRAFT`.

### BCK-030 — Adaptar actualización legacy

Mapear rutas legacy de draft únicamente a versiones `DRAFT`.

### BCK-031 — Adaptar confirmación legacy

Mapear `confirm` a publicación canónica únicamente cuando la validación backend sea satisfactoria.

### BCK-032 — Telemetría de consumo legacy

Registrar:

- endpoint;
- consumidor;
- frecuencia;
- errores;
- fecha de último uso.

La eliminación de rutas legacy requiere evidencia de no consumo y ventana de deprecación.

## Fase 6 — Pruebas

### Unitarias

- máquina de estados;
- creación de versiones;
- publicación;
- soft delete;
- control optimista;
- validaciones por dominio.

### Integración

- persistencia transaccional;
- unicidad de versión activa;
- rollback ante fallo de publicación;
- auditoría completa.

### Contrato

- validación contra los OpenAPI propuestos;
- compatibilidad de respuestas legacy;
- códigos `400`, `404`, `409` y `422`.

### Migración

- drafts legacy convertidos sin pérdida;
- configuraciones activas con versión estable;
- historial consistente;
- ejecución bloqueada para `INACTIVE` y `ARCHIVED`.

## Orden recomendado

1. BCK-001 a BCK-003
2. BCK-004 a BCK-009
3. BCK-010 a BCK-018
4. BCK-019 a BCK-028
5. BCK-029 a BCK-032
6. pruebas de contrato y migración

## Definition of Done del backend

- contratos canónicos implementados y certificados;
- rutas legacy encapsuladas y telemetrizadas;
- ninguna lógica de versionado en frontend;
- auditoría completa;
- pruebas unitarias, integración, contrato y migración en PASS;
- documentación actualizada en `enterprise-dataops-platform-ui`.
