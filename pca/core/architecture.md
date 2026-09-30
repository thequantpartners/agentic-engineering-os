# Arquitectura del Sistema & Topología

## 1. Principios de Arquitectura
- **Arquitectura Hexagonal (Ports & Adapters):** Dominio puro desacoplado de bases de datos y APIs externas.
- **POO con Domain-Driven Design (DDD):** Entidades con métodos de negocio y Value Objects inmutables.
- **Aspect-Oriented Programming (AOP):** Telemetría, logs y auditoría desacoplados mediante decoradores.
- **Zero Trust:** Bases de datos y workers nunca expuestos a `0.0.0.0`.

## 2. Diagrama de Contenedores (C4)
Modela en `docs/architecture/uml/` la relación entre contenedores Docker, proxies y almacenamiento persistente.
