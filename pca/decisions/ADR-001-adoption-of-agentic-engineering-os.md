# ADR-001: Adopción del Sistema Operativo de Ingeniería Agéntica (Agentic Engineering OS)

## Estado
Aceptado

## Contexto & Planteamiento del Problema
Para escalar el desarrollo de software eliminando el "vibe coding" y erradicando la sobreingeniería, se requiere una estructura organizacional y técnica donde una IA actúe como Arquitecto Fellow y Jefe de Ingeniería (Smith), orquestando a 5 especialistas bajo principios de POO limpia, SOLID, Arquitectura Hexagonal y C4 en Mermaid.

## Decisión Técnica
1. Establecer una jerarquía canónica de 2 niveles: Kenneth (Estratega) ➔ Smith (Orquestador en Jefe) ➔ Escuadrón de 5 especialistas (`@architect-researcher`, `@core-builder`, `@product-frontend`, `@secops-infra`, `@truth-gate`).
2. Smith gobierna de forma exclusiva el sistema de memoria y decisiones PCA para no saturar a los subagentes.
3. Todo módulo transita obligatoriamente por el ciclo SDD de 4 pasos (Contexto JIT, Spec SDD-6 con matriz POO, Construcción con contratos bloqueados, Auditoría determinista).

## Consecuencias
### Positivas:
- Código de grado industrial con tipado estricto, encapsulamiento POO y cero modelos anémicos.
- Portabilidad total entre Antigravity, Claude Code, OpenAI Codex y Cursor.
- Verificación determinista en consola con `exit code 0` antes de cualquier entrega.
### Mitigaciones:
- Smith aplica pushback técnico obligatorio para evitar sobreingeniería y abstracciones prematuras (KISS + YAGNI + SOLID).

## Verificación
`npm test` (`harness:syntax`, `harness:sdd`, `harness:invariants`, `harness:security` en Exit Code 0).
