# Stack Tecnológico Canónico

## 1. Runtimes & Lenguajes
- **Node.js:** Versión 20+ LTS
- **TypeScript:** Versión 5+ en modo estricto (`strict: true`)
- **Docker:** Contenedores multicapa basados en imágenes Debian/Alpine no-root

## 2. Frameworks & Librerías
- **Backend / API Gateway:** Fastify / Express desacoplado
- **Validación de Datos:** Zod para contratos tipados de entrada y Structured Outputs
- **Modelado Visual:** Mermaid.js en archivos Markdown
- **Logging & M.E.L.T.:** Pino estructurado y métricas sin sobrecarga

## 3. Capa de AI Engineering
- **Interfaces:** `IAiModelPort`, `IToolRegistryPort`
- **Proveedores Soportados:** Groq, Google Gemini, Anthropic, OpenRouter
- **Resiliencia:** `AbortSignal.timeout(...)`, exponential backoff con jitter y límites estrictos de `max_tokens`
