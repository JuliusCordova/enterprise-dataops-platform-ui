# Jarvis Backend Snapshot

Este directorio contiene una copia versionada del backend utilizado como base funcional para **Profiling, Data Quality y Reconciliation** dentro de Enterprise DataOps Platform.

## Proveniencia

- Repositorio fuente: `JuliusCordova/intercorp-fest-agent`
- Rama fuente: `feature/data-quality-engine`
- Snapshot de referencia: `80c927df9bf8ba4faaa2b34990310e52b4fedc90`
- Runtime asociado conocido: servicio Cloud Run `jarvis-reconciliation-agent`

> El nombre del servicio Cloud Run no está hardcodeado en el código fuente. La trazabilidad exacta `commit → image digest → Cloud Run revision` continúa como `TO_VALIDATE` hasta certificar el deployment.

## Entry point

El backend fuente se ejecuta mediante:

```text
uvicorn main:app --host 0.0.0.0 --port ${PORT}
```

## Alcance copiado

Se conserva el código ejecutable relevante para:

- API FastAPI (`main.py`);
- funciones/agente heredado (`agent.py`);
- perfilamiento;
- configuración y ejecución de Data Quality;
- lifecycle canónico de Data Quality;
- lifecycle canónico de Reconciliation;
- esquemas SQL;
- pruebas contractuales relevantes;
- dependencias y Dockerfile del backend.

No se copian backups históricos, logs ni artefactos temporales del repositorio fuente.

## Regla de ownership

A partir de este snapshot, `backend/jarvis` se considera la copia integrada del backend dentro del repositorio de Enterprise DataOps Platform para trabajo del equipo. El repositorio `intercorp-fest-agent` se conserva como fuente histórica/proveniencia hasta completar la estrategia de consolidación definitiva.
