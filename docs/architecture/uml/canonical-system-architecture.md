# Arquitectura Canónica del Sistema: Modelo C4 & UML 2.5 en Mermaid

> **Declaración Canónica:** LEI AGENTS Y PCA  
> **Formato:** Mermaid.js Nativo en Markdown (AI Context Parseable + Visual Rendering)  
> **Ubicación Canónica:** `docs/architecture/uml/canonical-system-architecture.md`

---

## 1. C4 Model — Nivel 1: Contexto del Sistema (System Context)

Muestra los límites del sistema The Quant Partners Engine, los actores humanos y los sistemas externos que interactúan con él.

```mermaid
flowchart TD
    subgraph Actores ["Actores Humanos"]
        K["Kenneth Herrera<br/>(Socio Director & Estratega)"]
        CL["Clientes B2B de Flota<br/>(Agencias, Coaches, Empresas)"]
        LEAD["Prospectos Calificados B2B<br/>(Tomadores de Decisión / CEOs)"]
    end

    subgraph Sistema ["THE QUANT PARTNERS ENGINE (SISTEMA CENTRAL)"]
        ENGINE["QP Monorepo Engine<br/>- Outreach B2B Engine<br/>- Soplo AI Voice Assistant<br/>- InfraQoPilot SecOps"]
    end

    subgraph Externos ["Sistemas Externos & Cloud Multi-Edge"]
        WA_NET["Red WhatsApp<br/>(Baileys Multi-Device)"]
        CF_EDGE["Cloudflare Edge & R2<br/>(Anycast, WAF, Workers, $0 Egress)"]
        AI_PROV["Proveedores de IA<br/>(Groq Llama-3, Google Gemini)"]
        META["Meta Ads & Instagram APIs<br/>(Scraping & Lead Retrieval)"]
        CRM["Sistemas CRM & Webhooks<br/>(Zoho, Google Sheets)"]
    end

    K -->|Orquesta & Configura| ENGINE
    CL -->|Gestiona Campañas| ENGINE
    ENGINE -->|Envía Secuencias & Audios| WA_NET
    WA_NET -->|Interacción en Tiempo Real| LEAD
    ENGINE -->|Caché & Almacenamiento| CF_EDGE
    ENGINE -->|Inferencia de Lenguaje| AI_PROV
    ENGINE -->|Prospección B2B| META
    ENGINE -->|Sincronización de Leads| CRM
```

---

## 2. C4 Model — Nivel 2: Contenedores (Container Diagram)

Detalla los contenedores de software que componen el monorepo y cómo se comunican bajo la doctrina Zero Trust.

```mermaid
flowchart TB
    subgraph Host ["VPS Hetzner / Coolify Bare-Metal (Docker Isolation)"]
        subgraph DMZ ["Capa Perimetral (Cloudflare Zero Trust)"]
            TUNNEL["Cloudflare Tunnel (cloudflared)<br/>Sin puertos expuestos a 0.0.0.0"]
        end

        subgraph CoreApp ["Contenedor Docker: qp-engine-core (Node.js 20+ TS)"]
            API["Fastify API Gateway<br/>(REST & Webhooks)"]
            HEX_APP["Dominio Hexagonal<br/>(Casos de Uso & Entidades POO)"]
            AOP_LAYER["Aspect Interceptors<br/>(Latency, Security, Retry)"]
            PORTS["Puertos de Infraestructura<br/>(Interfaces Inmutables)"]
            
            API --> AOP_LAYER
            AOP_LAYER --> HEX_APP
            HEX_APP --> PORTS
        end

        subgraph Workers ["Contenedor Docker: qp-workers"]
            WA_WORKER["Baileys WhatsApp Worker<br/>(Conexión WebSocket Cifrada)"]
            EMAIL_WORKER["Cold Email Worker<br/>(SMTP & Health Guard)"]
        end

        subgraph Storage ["Contenedor Docker: Data Store"]
            DB[(PostgreSQL 16 + Redis Cache<br/>Aislado en Red Interna)]
        end
    end

    TUNNEL -->|Proxy Seguro| API
    PORTS -->|Persistencia| DB
    PORTS -->|Mensajería| WA_WORKER
    PORTS -->|Despacho| EMAIL_WORKER
    WA_WORKER -.-> DB
```

---

## 3. Diagrama de Clases POO / DDD (Class Diagram)

Modela la pureza orientada a objetos del núcleo de negocio: Entidades con identidad, Value Objects inmutables, Casos de Uso y Puertos desacoplados.

```mermaid
classDiagram
    direction TB

    %% Value Objects Inmutables
    class LeadId {
        -string value
        +create(raw: string) LeadId
        +toString() string
    }

    class PhoneNumber {
        -string value
        +create(raw: string) PhoneNumber
        +toString() string
    }

    class LeadBudget {
        -number amount
        -string currency
        +create(amount: number, currency: string) LeadBudget
        +isSbsCompliant() boolean
    }

    class LeadStatus {
        <<enumeration>>
        DISCOVERED
        ENRICHED
        CONTACTED
        WARM_ENGAGED
        QUALIFIED_SBS
        CLOSED_WON
        DISQUALIFIED
    }

    %% Entidad Raíz de Agregado
    class Lead {
        -LeadId id
        -PhoneNumber phone
        -LeadBudget budget
        -LeadStatus status
        -Date createdAt
        -Date updatedAt
        +changeStatus(newStatus: LeadStatus) void
        +recordInteraction(message: string) void
        +isQualifiedForClosing() boolean
    }

    %% Puertos Hexagonales (Interfaces)
    class ILeadRepository {
        <<interface>>
        +findById(id: LeadId) Promise~Lead~
        +save(lead: Lead) Promise~void~
    }

    class IAiModelPort {
        <<interface>>
        +generateResponse(context: string, prompt: string) Promise~string~
    }

    class IMessageDispatcherPort {
        <<interface>>
        +sendWhatsApp(to: PhoneNumber, body: string) Promise~boolean~
    }

    %% Adaptadores de Infraestructura
    class PostgreSqlLeadRepository {
        -DatabaseClient db
        +findById(id: LeadId) Promise~Lead~
        +save(lead: Lead) Promise~void~
    }

    class GroqLlamaAdapter {
        -string apiKey
        -string model
        +generateResponse(context: string, prompt: string) Promise~string~
    }

    class BaileysWhatsAppAdapter {
        -WASocket socket
        +sendWhatsApp(to: PhoneNumber, body: string) Promise~boolean~
    }

    %% Caso de Uso Orquestador
    class ProcessIncomingLeadMessageUseCase {
        -ILeadRepository leadRepo
        -IAiModelPort aiPort
        -IMessageDispatcherPort dispatcher
        +execute(leadId: string, message: string) Promise~void~
    }

    %% Relaciones POO
    Lead *-- LeadId : compone
    Lead *-- PhoneNumber : compone
    Lead *-- LeadBudget : compone
    Lead *-- LeadStatus : tiene estado

    ProcessIncomingLeadMessageUseCase --> ILeadRepository : depende de
    ProcessIncomingLeadMessageUseCase --> IAiModelPort : depende de
    ProcessIncomingLeadMessageUseCase --> IMessageDispatcherPort : depende de

    PostgreSqlLeadRepository ..|> ILeadRepository : implementa
    GroqLlamaAdapter ..|> IAiModelPort : implementa
    BaileysWhatsAppAdapter ..|> IMessageDispatcherPort : implementa
```

---

## 4. Diagrama de Secuencia con AOP (Sequence Diagram)

Ilustra la ejecución determinista del Caso de Uso, mostrando cómo los **Aspectos transversales (AOP)** interceptan la llamada sin contaminar el dominio.

```mermaid
sequenceDiagram
    autonumber
    actor WA as Lead (WhatsApp)
    participant Adapt as BaileysWhatsAppAdapter
    participant AOP as AOP Interceptors (@TrackLatency / @AuditSecurity)
    participant UC as ProcessIncomingLeadMessageUseCase
    participant Repo as PostgreSqlLeadRepository
    participant AI as GroqLlamaAdapter (IA Port)
    participant DB as PostgreSQL DB

    WA->>Adapt: Mensaje entrante ("Quiero info del servicio")
    Adapt->>AOP: execute(leadId, message)
    activate AOP
    Note over AOP: 1. @AuditSecurity: Sanitiza input & valida permisos<br/>2. @TrackLatency: Inicia timer de alta resolución
    AOP->>UC: execute(leadId, message)
    activate UC

    UC->>Repo: findById(leadId)
    Repo->>DB: SELECT * FROM leads WHERE id = leadId
    DB-->>Repo: Record Data
    Repo-->>UC: Lead Entity (POO)

    UC->>UC: lead.recordInteraction(message)

    UC->>AI: generateResponse(context, prompt)
    activate AI
    AI-->>UC: Respuesta Canónica Tipada
    deactivate AI

    UC->>Adapt: sendWhatsApp(lead.phone, response)
    Adapt-->>WA: Envío de mensaje en WhatsApp

    UC->>UC: lead.changeStatus(WARM_ENGAGED)
    UC->>Repo: save(lead)
    Repo->>DB: UPDATE leads SET status = 'WARM_ENGAGED'...
    DB-->>Repo: OK
    Repo-->>UC: Void

    UC-->>AOP: Success
    deactivate UC

    Note over AOP: 3. @TrackLatency: Registra métrica (e.g. 142ms)
    AOP-->>Adapt: Void
    deactivate AOP
```

---

## 5. Diagrama de Estados Finitos del SMF (State Diagram)

Modela el ciclo de vida determinista de un lead en el motor comercial:

```mermaid
stateDiagram-v2
    [*] --> DISCOVERED : Ingesta inicial (Scraping / Meta Ads)
    DISCOVERED --> ENRICHED : Apify / Apollo Data Enrichment
    ENRICHED --> CONTACTED : Despacho de Primer Mensaje
    CONTACTED --> WARM_ENGAGED : Lead responde en WhatsApp
    CONTACTED --> DISQUALIFIED : Sin respuesta tras 3 toques / Rechazo explícito
    WARM_ENGAGED --> QUALIFIED_SBS : Confirma presupuesto y cumple split 50/50
    WARM_ENGAGED --> DISQUALIFIED : No cuenta con presupuesto mínimo
    QUALIFIED_SBS --> CLOSED_WON : Pago de Setup procesado & Contrato firmado
    CLOSED_WON --> [*]
    DISQUALIFIED --> [*]
```
