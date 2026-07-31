# ADR-001 — Frontend unificado y separación canónica de backends

**Estado:** Aprobado  
**Fecha:** 2026-07-31  
**Repositorio canónico:** `JuliusCordova/enterprise-dataops-platform-ui`

## 1. Decisión

La plataforma Enterprise DataOps utilizará **un único frontend unificado** para las capacidades de:

- perfilamiento de datos;
- calidad de datos;
- cuadratura y reconciliación;
- Silver Refinement / Bronze → Silver;
- ejecuciones;
- gobierno;
- inteligencia operativa y AgentOps.

El frontend no duplicará lógica de negocio ni implementará motores de cálculo. Su responsabilidad será experiencia de usuario, navegación, composición de vistas y consumo de contratos backend mediante el BFF.

## 2. Backends canónicos

### 2.1 Jarvis — Quality, Profiling y Reconciliation

Backend responsable de:

- profiling;
- data quality;
- reconciliación y cuadratura;
- configuración, validación, versionado y ciclo de vida de estos dominios.

Rutas canónicas:

- `/api/quality/*`
- `/api/profiling/*`
- `/api/reconciliation/*`

Jarvis no administra workflows Bronze → Silver.

### 2.2 Silver Refinement Agent — Bronze → Silver

Backend responsable de:

- descubrimiento de datos Bronze;
- generación de mapeos Bronze → Silver;
- reglas de transformación;
- workflows de refinamiento;
- artefactos y paquetes de ejecución;
- ejecuciones;
- gobierno, trazabilidad, AgentOps e inteligencia operativa.

Rutas canónicas:

- `/api/silver/*`
- `/api/executions/*`
- `/api/governance/*`
- `/api/intelligence/*`

Silver Refinement no ejecuta profiling, calidad ni reconciliación.

## 3. Persistencia de Silver Refinement

AlloyDB queda excluido del runtime por costo operativo.

La persistencia canónica de Silver Refinement será:

- **Cloud Storage con documentos JSON** para workflows, versiones, reglas, configuraciones, snapshots, memoria resumida, idempotencia, artefactos y auditoría técnica;
- **BigQuery** para lectura Bronze, escritura Silver y explotación analítica;
- **Dataproc Serverless**, cuando corresponda, para ejecutar procesamiento distribuido.

No deben reintroducirse dependencias activas de:

- `WORKFLOW_DATABASE_URL`;
- `MEMORY_DATABASE_URL`;
- `DATABASE_URL` asociadas a AlloyDB;
- migraciones SQL de AlloyDB como requisito del runtime Silver;
- `alloydb-power-controller` como dependencia funcional de Silver Refinement.

La continuidad de limpieza y cierre backend se realizará desde:

`feature/sprint-8.1.3b2.10-alloydb-cleanup`

## 4. Frontend y BFF

El mismo frontend utilizado para calidad, perfilamiento y reconciliación será extendido para Silver Refinement.

El BFF deberá:

- enrutar cada dominio hacia su backend propietario;
- mantener DTOs por dominio;
- encapsular adaptadores legacy;
- propagar correlation IDs;
- normalizar errores sin simular operaciones exitosas;
- evitar URLs de Cloud Run codificadas directamente;
- no calcular reglas, métricas ni estados de negocio.

## 5. Ownership de rutas

| Dominio | Backend propietario | Prefijo |
|---|---|---|
| Calidad | Jarvis | `/api/quality/*` |
| Perfilamiento | Jarvis | `/api/profiling/*` |
| Reconciliación / cuadratura | Jarvis | `/api/reconciliation/*` |
| Silver Refinement | Silver Refinement Agent | `/api/silver/*` |
| Ejecuciones | Silver Refinement Agent | `/api/executions/*` |
| Gobierno | Silver Refinement Agent | `/api/governance/*` |
| Inteligencia / AgentOps | Silver Refinement Agent | `/api/intelligence/*` |

## 6. Reglas no negociables

- El frontend no reconstruye lógica existente en los backends.
- No se crea un frontend independiente para Silver Refinement.
- No se mezclan responsabilidades entre Jarvis y Silver Refinement.
- No se reintroduce AlloyDB en el runtime demo.
- No se comparten DTOs indiscriminadamente entre dominios.
- Una ruta no se considera verificada sin endpoint, método, DTO y evidencia.
- Una operación backend inexistente no debe presentarse como exitosa.
- Código y documentación deben evolucionar en el mismo PR cuando corresponda.
- GitHub es la fuente de verdad.
- Ningún PR se fusiona sin autorización explícita.

## 7. Secuencia de entrega

1. Cerrar backend Jarvis.
2. Cerrar backend Silver Refinement.
3. Validar contratos, persistencia, OpenAPI, pruebas y smoke real.
4. Integrar ambos backends en el frontend/BFF unificado.
5. Ejecutar validación end-to-end y despliegue controlado.

## 8. Consecuencias

### Positivas

- experiencia de usuario única;
- separación clara de responsabilidades;
- menor duplicación de lógica;
- reducción de costo al eliminar AlloyDB;
- evolución independiente de los backends;
- integración frontend posterior sobre contratos estabilizados.

### Restricciones aceptadas

- el BFF deberá manejar dos backends y contratos distintos;
- Cloud Storage JSON requiere control explícito de versionado, concurrencia e idempotencia;
- la integración frontend se realizará después del cierre backend.

## 9. Fuente de verdad

Este ADR prevalece sobre checkpoints anteriores que indiquen AlloyDB como persistencia activa o que propongan un frontend separado para Silver Refinement.
