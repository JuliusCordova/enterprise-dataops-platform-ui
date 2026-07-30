# Matriz de endpoints canónicos y legacy

## Propósito

Relacionar el contrato objetivo del producto con los endpoints actualmente certificados del backend Jarvis. Una fila `MISSING` no autoriza simulación en frontend ni BFF.

## Calidad de datos

| Capacidad | Endpoint canónico | Endpoint legacy certificado | Estado | Regla de transición |
|---|---|---|---|---|
| Listar configuraciones | `GET /data-quality/configurations` | `GET /data-quality/configs` | PARTIAL | Adapter traduce respuesta mientras se implementa el canónico. |
| Obtener detalle | `GET /data-quality/configurations/{id}` | `GET /data-quality/config/{quality_config_id}` | PARTIAL | Mantener alias explícito; no asumir identidad de versión. |
| Crear configuración | `POST /data-quality/configurations` | `POST /data-quality/configure/draft` | PARTIAL | Legacy crea draft; canónico debe crear identidad estable + versión 1. |
| Consultar draft | incluido en detalle/versiones | `GET /data-quality/configure/draft/{draftId}` | EXISTS | Conservar hasta completar migración. |
| Actualizar | `PUT /data-quality/configurations/{id}` | `PUT /data-quality/configure/draft/{draftId}` | PARTIAL | Solo equivalente para DRAFT; ACTIVE debe crear nueva versión. |
| Validar | operación interna o endpoint de versión | `POST /data-quality/configure/validate/{draftId}` | EXISTS | Mantener como compatibilidad temporal. |
| Publicar | `POST /data-quality/configurations/{id}/publish` | `POST /data-quality/configure/confirm/{draftId}` | PARTIAL | Confirm legacy se interpreta como publicación solo con respuesta backend válida. |
| Crear versión | `POST /data-quality/configurations/{id}/versions` | — | MISSING | Requiere implementación backend. |
| Cambiar estado | `PATCH /data-quality/configurations/{id}/status` | — | MISSING | No simular. |
| Archivar | `DELETE /data-quality/configurations/{id}` | — | MISSING | Soft delete backend. |
| Historial | `GET /data-quality/configurations/{id}/versions` | — | MISSING | Requiere persistencia versionada. |

## Reconciliación

| Capacidad | Endpoint canónico | Endpoint legacy certificado | Estado | Regla de transición |
|---|---|---|---|---|
| Listar configuraciones | `GET /reconciliation/configurations` | `GET /reconciliation/configs` | PARTIAL | Adapter encapsula alias. |
| Obtener detalle | `GET /reconciliation/configurations/{id}` | — | MISSING | No derivar detalle desde listados incompletos. |
| Crear configuración | `POST /reconciliation/configurations` | `POST /reconciliation/configure/draft` | PARTIAL | Legacy crea draft; canónico debe crear identidad estable + versión 1. |
| Consultar draft | incluido en detalle/versiones | `GET /reconciliation/configure/draft/{draftId}` | EXISTS | Conservar temporalmente. |
| Actualizar | `PUT /reconciliation/configurations/{id}` | `PUT /reconciliation/configure/draft/{draftId}` | PARTIAL | Solo equivalente para DRAFT. |
| Validar | `POST /reconciliation/configurations/{id}/validate` | `POST /reconciliation/configure/validate/{draftId}` | PARTIAL | Resolver configurationId → draft/version en backend. |
| Publicar | `POST /reconciliation/configurations/{id}/publish` | `POST /reconciliation/configure/confirm/{draftId}` | PARTIAL | Publicación transaccional y auditable. |
| Crear versión | `POST /reconciliation/configurations/{id}/versions` | — | MISSING | Requiere implementación backend. |
| Cambiar estado | `PATCH /reconciliation/configurations/{id}/status` | — | MISSING | No simular. |
| Archivar | `DELETE /reconciliation/configurations/{id}` | — | MISSING | Soft delete backend. |
| Historial | `GET /reconciliation/configurations/{id}/versions` | — | MISSING | Requiere persistencia versionada. |
| Ejecutar | endpoint operativo separado | `POST /reconciliation/execute` | EXISTS | Solo configuraciones ACTIVE pueden ejecutarse en el contrato objetivo. |
| Consultar resultado | endpoint operativo separado | `GET /reconciliation/result/{executionId}` | EXISTS | Sin cambios en Sprint D. |

## Estados

- `EXISTS`: contrato productivo certificado y semántica suficiente.
- `PARTIAL`: existe una ruta utilizable, pero no cubre completamente el contrato canónico.
- `MISSING`: no existe contrato backend certificado.

## Reglas de gobierno

1. Toda ruta legacy se encapsula en adapters BFF.
2. Ninguna operación `MISSING` se representa como exitosa en frontend.
3. La migración se realiza por capacidad y con telemetría.
4. El contrato canónico se considera propuesto hasta implementación, pruebas y certificación OpenAPI.
5. La eliminación de rutas legacy requiere ventana de deprecación y evidencia de no consumo.
