# Requerimientos no funcionales — Quality & Reconciliation

**Estado:** REVIEWED  
**Fecha baseline:** 2026-08-24

## 1. Arquitectura y separación de responsabilidades

| ID | Requerimiento |
|---|---|
| RNF-ARC-001 | El frontend/BFF no debe implementar cálculos de perfilamiento, calidad o reconciliación. |
| RNF-ARC-002 | Cada dominio debe consumir un backend propietario mediante cliente/adaptador explícito. |
| RNF-ARC-003 | Las URLs de runtime deben configurarse por ambiente; no deben depender de una URL Cloud Run fija como contrato de producto. |
| RNF-ARC-004 | Los contratos legacy deben encapsularse en adapters y no propagarse como deuda hacia la UX. |
| RNF-ARC-005 | Quality/Reconciliation y Silver Refinement deben mantener ownership separado; no se duplicará el motor entre repositorios. |

## 2. Seguridad

| ID | Requerimiento |
|---|---|
| RNF-SEC-001 | Toda invocación productiva debe usar identidad autenticada y autorización de mínimo privilegio. |
| RNF-SEC-002 | Credenciales/secretos no se almacenan en código ni repositorio; deben utilizar Secret Manager o mecanismo equivalente. |
| RNF-SEC-003 | Identificadores de proyecto/dataset/tabla/columna y filtros deben validarse antes de construir consultas. |
| RNF-SEC-004 | Las consultas generadas deben restringirse a activos y operaciones autorizadas. |
| RNF-SEC-005 | Los logs no deben exponer secretos ni datos sensibles a nivel fila salvo evidencia explícitamente gobernada. |
| RNF-SEC-006 | Toda publicación, cambio de estado y archivado debe registrar actor y timestamp. |

## 3. Auditabilidad y trazabilidad

| ID | Requerimiento |
|---|---|
| RNF-AUD-001 | Toda configuración y versión debe tener identificador estable, owner, timestamps y actor. |
| RNF-AUD-002 | Toda ejecución debe registrar `execution_id`, configuración, versión, modo, parámetros, fuente/corte, estado y timestamps. |
| RNF-AUD-003 | El release debe permitir relacionar runtime con SHA de frontend/BFF y SHA del backend propietario. |
| RNF-AUD-004 | La evidencia de pruebas/smoke debe quedar versionada o referenciada desde GitHub. |
| RNF-AUD-005 | No se eliminará historial requerido para reproducir una ejecución anterior. |

## 4. Confiabilidad e idempotencia

| ID | Requerimiento |
|---|---|
| RNF-REL-001 | Crear/publicar/ejecutar debe protegerse contra duplicados por reintentos cuando la operación no sea naturalmente idempotente. |
| RNF-REL-002 | El scheduler debe poder reintentar sin crear ejecuciones duplicadas para el mismo trigger lógico. |
| RNF-REL-003 | Errores de BigQuery/backend deben propagarse como fallos explícitos; el frontend no presentará `SUCCESS` local. |
| RNF-REL-004 | Las ejecuciones deben conservar estados terminales y evidencia de error. |
| RNF-REL-005 | El control optimista (`rowVersion`, `etag` o equivalente) es obligatorio al modificar configuraciones. |

## 5. Rendimiento y escalabilidad

| ID | Requerimiento |
|---|---|
| RNF-PERF-001 | Operaciones CRUD y metadata deben responder de forma interactiva; consultas largas no deben bloquear indefinidamente la experiencia web. |
| RNF-PERF-002 | Perfilamientos y ejecuciones de larga duración deben poder evolucionar a patrón asíncrono con `execution_id` consultable. |
| RNF-PERF-003 | El perfilamiento debe permitir limitar columnas y, cuando se implemente, estrategias de sampling configurables sin alterar silenciosamente métricas contractuales. |
| RNF-PERF-004 | El diseño debe soportar múltiples configuraciones y ejecuciones concurrentes sin compartir estado de sesión mutable entre usuarios. |
| RNF-PERF-005 | Costos de consultas deben ser observables y controlables mediante filtros, particiones, límites o políticas del motor. |

## 6. Observabilidad

| ID | Requerimiento |
|---|---|
| RNF-OBS-001 | Frontend/BFF/backend deben propagar correlation/trace ID. |
| RNF-OBS-002 | Deben existir métricas de solicitudes, errores, latencia, ejecuciones, duración y estado. |
| RNF-OBS-003 | Debe distinguirse ejecución `ON_DEMAND` de `SCHEDULED`. |
| RNF-OBS-004 | Cada ejecución debe registrar backend/service version cuando el runtime lo permita. |
| RNF-OBS-005 | Deben existir health checks diferenciados por dominio/backend. |

## 7. Versionado y compatibilidad

| ID | Requerimiento |
|---|---|
| RNF-VER-001 | Los contratos canónicos deben documentarse con OpenAPI y pruebas de contrato. |
| RNF-VER-002 | Cambios incompatibles requieren versión explícita o estrategia de transición. |
| RNF-VER-003 | No se promoverá código a producción si el frontend espera endpoints que el backend desplegado no certifica. |
| RNF-VER-004 | GitHub será fuente de verdad del código; imágenes desplegadas deben ser reproducibles desde un commit identificable. |
| RNF-VER-005 | `main` debe representar un baseline conocido; capacidades relevantes no deben permanecer indefinidamente solo en ramas de trabajo. |

## 8. UX y gobierno

| ID | Requerimiento |
|---|---|
| RNF-UX-001 | Los journeys deben ser guiados y reducir ingreso manual de identificadores técnicos. |
| RNF-UX-002 | Estados `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` deben ser visibles y consistentes. |
| RNF-UX-003 | Publicar, archivar o sobrescribir una versión debe requerir confirmación explícita. |
| RNF-UX-004 | Una sugerencia de IA/regla no debe confundirse con una regla publicada. |
| RNF-UX-005 | La UI debe explicar el resultado usando métricas calculadas por backend, sin reinterpretar silenciosamente tolerancias. |

## 9. Datos y reproducibilidad

| ID | Requerimiento |
|---|---|
| RNF-DAT-001 | Un perfil histórico debe persistir el corte/filtro/snapshot utilizado. |
| RNF-DAT-002 | Una reconciliación debe persistir origen, destino, filtros, tolerancias y versión usados. |
| RNF-DAT-003 | Los resultados deben distinguir metadata/evidencia de configuración de los datos de negocio consultados. |
| RNF-DAT-004 | Una modificación posterior de configuración no debe cambiar retrospectivamente la interpretación de ejecuciones históricas. |

## 10. Gate mínimo de release

Antes de promover una capacidad P0:

- build y unit tests PASS;
- contract/OpenAPI tests PASS;
- smoke contra backend real PASS;
- no fallbacks `LOCAL_*` presentados como éxito;
- SHA(s) registrados;
- matriz RF/RNF actualizada;
- evidencia de seguridad/configuración de ambiente revisada;
- rollback definido.
