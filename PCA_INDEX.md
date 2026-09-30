# PCA Index — Product Context & Architecture

## Project
Name: Agentic Engineering OS
Type: Multi-Agent Software Engineering Framework & Starter Kit
Stage: production-ready

## Active Objective
Proveer una base de ingeniería de software de élite mundial para construir proyectos con IA bajo la dirección de Smith y 11 subagentes especializados.

## Critical Runtime Rule
1. **Solo Smith (Orquestador en Jefe) lee y mantiene este índice y la carpeta `pca/`.**
2. Los subagentes tácticos (`@implementer`, `@qa`, `@security`, etc.) NO deben leer la carpeta `pca/` para no saturar su ventana de contexto.
3. Smith traduce el contexto estratégico en contratos de especificación SDD acotados.
4. Consulta Just-In-Time (JIT): no leas toda la carpeta `pca/` de golpe; recupera solo los archivos relevantes para la tarea en curso.

## Core Files
- `pca/core/project-brief.md`: Misión, propuesta de valor y catálogo de módulos.
- `pca/core/architecture.md`: Topología de contenedores, aislamiento y redes.
- `pca/core/stack.md`: Runtimes, librerías autorizadas y herramientas.
- `pca/state/active-task.md`: Tarea viva en curso.
- `pca/state/roadmap.md`: Hitos inmediatos y visión de evolución.
- `pca/state/changelog.md`: Historial de cambios mayores.
- `pca/state/active-decisions.md`: Índice de Decisiones de Arquitectura (ADRs).

## Decision Records (ADRs)
- `ADR-001`: Adopción del Sistema Operativo de Ingeniería Agéntica (Agentic Engineering OS).

## Closure Policy
Solo tras confirmación explícita del usuario (`SI`):
1. Actualizar `roadmap.md`
2. Actualizar `changelog.md`
3. Registrar decisión en `pca/decisions/` si aplica
