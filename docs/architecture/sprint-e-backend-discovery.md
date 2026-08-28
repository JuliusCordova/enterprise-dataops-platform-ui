# Sprint E — Gate de descubrimiento del backend

## Objetivo

Identificar de forma verificable el repositorio ejecutable del backend Jarvis antes de crear ramas o modificar código fuera de `enterprise-dataops-platform-ui`.

## Evidencia conocida

- Servicio productivo identificado como `jarvis-reconciliation-agent`.
- URL de ejecución conocida: `https://jarvis-reconciliation-agent-913797829604.us-central1.run.app`.
- El frontend consume rutas de calidad y reconciliación mediante adapters BFF.
- La documentación canónica del producto permanece en `enterprise-dataops-platform-ui`.

La URL de Cloud Run no demuestra por sí sola cuál es el repositorio Git ni su rama base.

## Gate obligatorio

Antes de implementar persistencia o endpoints canónicos se deben registrar:

1. ruta local del repositorio;
2. URL exacta de `origin`;
3. rama base activa;
4. commit HEAD;
5. evidencia de código backend u OpenAPI Jarvis;
6. resultado de build y pruebas existentes.

## Ejecución

```bash
cd ~/enterprise-dataops-platform-ui

git fetch origin
git switch docs/sprint-e-backend-discovery
git pull --ff-only origin docs/sprint-e-backend-discovery

bash scripts/discovery/discover_backend_repository.sh \
  "$HOME" \
  artifacts/backend-discovery/backend-repository-evidence.txt
```

## Criterio de selección

Un candidato es válido cuando cumple simultáneamente:

- contiene código ejecutable de backend, no solo frontend/BFF;
- posee un `origin` verificable;
- tiene una rama base identificable;
- contiene rutas certificadas de Jarvis o su OpenAPI;
- puede ejecutar su build sin modificar trabajo local no versionado.

## Restricciones

- No crear el CRUD en el repositorio frontend.
- No inferir el repositorio desde la URL de Cloud Run.
- No usar `git clean`, `reset --hard`, `add -A` ni eliminar archivos locales.
- No iniciar cambios backend hasta cerrar este gate con evidencia.
- Toda decisión y evidencia resultante se documentará en este repositorio.

## Resultado esperado

El archivo `artifacts/backend-discovery/backend-repository-evidence.txt` debe permitir seleccionar un único repositorio o declarar explícitamente que el backend no está clonado en Cloud Shell.

Una vez identificado, el siguiente incremento creará la rama backend de Sprint E y comenzará por:

- `configuration`;
- `configuration_version`;
- `configuration_audit_event`;
- primer flujo CRUD canónico de calidad.
