# Enterprise Microservices Architecture (Kubernetes + Multi-Tenant + Non-Technical UX)

This document provides the secure enterprise service architecture and the UX expansion needed for non-technical setup and operation.

## System Context (C4 L1)

```mermaid
flowchart TB
  %% =========================
  %% External
  %% =========================
  subgraph External
    Users[End Users]
    Admins[Tenant Admins]
    IdP["Enterprise IdP<br/>(OIDC/SAML)"]
    Channels[Channel Platforms<br/>WhatsApp / Telegram / Slack / etc]
    Clawhub[ClawHub]
    Mail[Email / Notification Providers]
  end

  %% =========================
  %% OpenClaw Enterprise Platform
  %% =========================
  subgraph OpenClawEnterprise[OpenClaw Enterprise Platform]
    WebPortal[Enterprise Web Portal]
    Edge[API Gateway / Edge]
    Identity[Identity & SSO Service]
    Onboarding[Onboarding Experience Service]
    AccountSetup[Account Setup API]
    Tenant[Tenant Service]
    Policy[Policy Service]
    ChannelProvision[Channel Provisioning Orchestrator]
    ChannelAssistant[Channel Setup Assistant]
    ChannelIngress[Channel Ingress Service]
    Orchestrator[Orchestration Service]
    Conversation[Conversation & Memory Service]
    ProviderProxy[Provider Proxy]
    SkillsCatalog[Skills Catalog & Install API]
    SkillControl[Skill Control Plane]
    SkillNode["Skill Runtime (Node.js)"]
    SkillPython["Skill Runtime (Python)"]
    CredentialBroker[Credential Broker]
    Notification[User Notification Service]
    Audit[Audit & Observability]
  end

  %% =========================
  %% Data Layer
  %% =========================
  subgraph Data
    Postgres["(Postgres)"]
    Redis["(Redis)"]
    Bus["(Event Bus)"]
    ObjectStore["(Object Storage)"]
    Vault["(Vault / SecretRef)"]
    SIEM["(SIEM / Log Sink)"]
  end

  %% =========================
  %% Flows
  %% =========================

  Users --> WebPortal
  Admins --> WebPortal
  WebPortal --> Edge

  Edge --> Identity
  Edge --> Onboarding
  Edge --> AccountSetup
  Edge --> ChannelProvision
  Edge --> SkillsCatalog

  Identity <--> IdP

  Onboarding --> Tenant
  AccountSetup --> Tenant

  ChannelProvision --> CredentialBroker
  ChannelAssistant --> ChannelProvision
  ChannelProvision --> ChannelIngress

  Channels --> ChannelIngress
  ChannelIngress --> Bus

  Orchestrator --> Bus
  Orchestrator --> Conversation
  Orchestrator --> ProviderProxy
  Orchestrator --> SkillControl

  SkillControl --> SkillNode
  SkillControl --> SkillPython

  SkillsCatalog --> SkillControl
  SkillsCatalog --> Clawhub

  Notification --> Mail
  Audit --> SIEM

  Identity --> Postgres
  Tenant --> Postgres
  Policy --> Postgres
  Onboarding --> Postgres
  AccountSetup --> Postgres
  ChannelProvision --> Postgres
  SkillsCatalog --> Postgres
  Conversation --> Postgres
  Conversation --> ObjectStore
  SkillControl --> Postgres
  SkillControl --> ObjectStore
  Orchestrator --> Redis
  CredentialBroker --> Vault
  Audit --> Postgres
```

## Service Container Diagram (C4 L2)

```mermaid
flowchart LR
  WebPortal[Enterprise Web Portal] --> Edge[API Gateway]
  Edge --> Identity[Identity/SSO]
  Edge --> Onboarding[Onboarding Experience]
  Edge --> AccountSetup[Account Setup API]
  Edge --> ChannelProvision[Channel Provisioning]
  Edge --> SkillsCatalog[Skills Catalog API]

  Onboarding --> Tenant[Tenant]
  AccountSetup --> Tenant
  Edge --> Policy[Policy]

  ChannelAssistant[Channel Setup Assistant] --> ChannelProvision
  ChannelProvision --> CredentialBroker[Credential Broker]
  ChannelProvision --> ChannelIngress[Channel Ingress]
  ChannelIngress --> Bus[(Event Bus)]

  Orchestrator[Orchestration] --> Bus
  Orchestrator --> Conversation[Conversation/Memory]
  Orchestrator --> ProviderProxy[Provider Proxy]
  Orchestrator --> SkillControl[Skill Control Plane]

  SkillsCatalog --> SkillControl
  SkillsCatalog --> Clawhub[ClawHub]
  SkillControl --> SkillNode[Skill Runtime: Node]
  SkillControl --> SkillPython[Skill Runtime: Python]

  Notification[User Notification] --> Mail[Email/SMS Provider]
  Audit[Audit & Observability] --> SIEM[(SIEM/Logs)]

  Identity --> Postgres[(Postgres)]
  Tenant --> Postgres
  Onboarding --> Postgres
  AccountSetup --> Postgres
  ChannelProvision --> Postgres
  SkillsCatalog --> Postgres
  Conversation --> Postgres
  SkillControl --> Postgres
  CredentialBroker --> Vault[(Vault/SecretRef)]
  Orchestrator --> Redis[(Redis)]
```

## Kubernetes Deployment (Logical)

```mermaid
flowchart TB
  subgraph NamespaceProd [prod namespace]
    direction TB

    %% Entry Points
    Ingress[Ingress Controller + WAF]
    WebPortal[Enterprise Web Portal]
    Edge[API Gateway]
    Mesh{Service Mesh - mTLS}

    subgraph CoreServices [Core Business Logic]
        Identity[Identity]
        Onboarding[Onboarding]
        AccountSetup[Account Setup API]
        Tenant[Tenant]
        Policy[Policy]
        Notification[Notification]
        Audit[Audit/Observability]
    end

    subgraph ChannelLogic [Channel & Provisioning]
        ChannelProvision[Channel Provisioning]
        ChannelAssistant[Channel Assistant]
        ChannelIngress[Channel Ingress]
        SkillsCatalog[Skills Catalog API]
    end

    subgraph ExecutionLayer [Orchestration & Skills]
        Orchestrator[Orchestration]
        Conversation[Conversation/Memory]
        SkillControl[Skill Control]
        SkillNode[Skill Runner Node]
        SkillPython[Skill Runner Python]
        ProviderProxy[Provider Proxy]
        CredentialBroker[Credential Broker]
    end
  end

  subgraph DataPlane [Stateful Services]
    Postgres[(Postgres HA)]
    Redis[(Redis)]
    Bus[(Event Bus)]
    ObjectStore[(Object Storage)]
    Vault[(Vault/SecretRef)]
  end

  %% Routing Flow
  Ingress --> WebPortal
  Ingress --> Edge
  Edge --> Mesh

  %% Mesh to Groups
  Mesh --> CoreServices
  Mesh --> ChannelLogic
  Mesh --> ExecutionLayer

  %% Internal Logic
  ChannelIngress --> Bus
  Orchestrator --> Bus
  SkillControl --> SkillNode
  SkillControl --> SkillPython

  %% Data Persistence (Consolidated for clarity)
  CoreServices & ChannelLogic & Conversation --> Postgres
  Orchestrator --> Redis
  Conversation --> ObjectStore
  CredentialBroker --> Vault
  Audit --> Postgres
```

## Sequence: Self-Serve Signup to Bootstrap

```mermaid
sequenceDiagram
  participant User as End User
  participant Portal as Enterprise Web Portal
  participant Onboarding as Onboarding Service
  participant Identity as Identity Service
  participant Notification as Notification Service
  participant AccountSetup as Account Setup API
  participant Tenant as Tenant Service
  participant Audit as Audit Service

  User->>Portal: Submit signup form
  Portal->>Onboarding: POST /v1/onboarding/signup
  Onboarding->>Notification: Send verification email
  Notification-->>User: Verification link
  User->>Portal: Verify + continue login
  Portal->>Identity: OIDC login flow
  Identity-->>Portal: Authenticated session
  Portal->>AccountSetup: POST /v1/onboarding/bootstrap
  AccountSetup->>Tenant: Create tenant/workspace defaults
  AccountSetup->>Audit: Emit onboarding.tenant.bootstrapped
  AccountSetup-->>Portal: Bootstrap complete
```

## Sequence: Invite-Only Activation

```mermaid
sequenceDiagram
  participant Admin as Tenant Admin
  participant Portal as Enterprise Web Portal
  participant Onboarding as Onboarding Service
  participant User as Invitee
  participant Identity as Identity Service
  participant Audit as Audit Service

  Admin->>Portal: Invite user by email
  Portal->>Onboarding: Issue invite token
  Onboarding-->>User: Invite email + token
  User->>Portal: Accept invite
  Portal->>Onboarding: POST /v1/onboarding/invite/accept
  Onboarding->>Identity: Create invite-linked identity profile
  Onboarding->>Audit: Emit onboarding.user.created
  Onboarding-->>Portal: Invite user activated
```

## Sequence: Guided Channel Connection

```mermaid
sequenceDiagram
  participant User as User
  participant Portal as Web Portal
  participant ChannelProvision as Channel Provisioning
  participant Broker as Credential Broker
  participant Ingress as Channel Ingress
  participant Audit as Audit Service

  User->>Portal: Select channel and account setup
  Portal->>ChannelProvision: POST /v1/channels/connections
  ChannelProvision->>Broker: Resolve/setup credentials (OAuth/token/QR)
  Broker-->>ChannelProvision: Credential reference
  ChannelProvision->>Ingress: Register channel connection
  ChannelProvision->>Audit: Emit channel.connection.created
  ChannelProvision-->>Portal: Connection pending
  Portal->>ChannelProvision: POST /v1/channels/connections/{id}/verify
  ChannelProvision->>Audit: Emit verified/failed event
  ChannelProvision-->>Portal: Connection status
```

## Sequence: Skill Install from UI + Channel Invocation

```mermaid
sequenceDiagram
  participant User as User
  participant Portal as Web Portal
  participant Skills as Skills Catalog API
  participant Clawhub as ClawHub
  participant Control as Skill Control Plane
  participant Assistant as Channel Setup Assistant
  participant Runtime as Skill Runtime
  participant Audit as Audit Service

  User->>Portal: Browse skill catalog
  Portal->>Skills: GET /v1/skills/catalog
  Skills->>Clawhub: Resolve metadata and versions
  User->>Portal: Install skill
  Portal->>Skills: POST /v1/skills/install
  Skills->>Control: Admit + activate skill
  Skills->>Audit: Emit skill.install.completed
  User->>Assistant: /skill <name> <input>
  Assistant->>Runtime: Execute skill
  Runtime->>Audit: Record skill execution
  Runtime-->>Assistant: Result
```

## Sequence: First-Run Happy Path E2E

```mermaid
sequenceDiagram
  participant User as User
  participant Portal as Web Portal
  participant Onboarding as Onboarding
  participant Identity as Identity
  participant ChannelProvision as Channel Provisioning
  participant Skills as Skills Catalog
  participant Assistant as Channel Setup Assistant

  User->>Portal: Self-serve signup
  Portal->>Onboarding: signup + wizard state
  User->>Portal: Login
  Portal->>Identity: OIDC callback success
  User->>Portal: Bootstrap tenant/workspace
  Portal->>Onboarding: setup/complete
  User->>Portal: Connect channel
  Portal->>ChannelProvision: create + verify connection
  User->>Portal: Install first skill
  Portal->>Skills: install + configure
  User->>Assistant: Send first channel command
  Assistant-->>User: First successful response
```

## Local Kubernetes implementation (Milestone 17)

```mermaid
flowchart LR
  Browser[http://localhost:18788] --> PortForward[kubectl port-forward]
  PortForward --> Portal[enterprise-portal-hostpath svc:4020]
  Portal --> Onboarding[onboarding-service-hostpath svc:4010]
  Portal --> Identity[identity-service svc:4001]
  Onboarding --> Tenant[tenant-service]
  Onboarding --> Policy[policy-service]
```

- Portal is now implemented as `@openclaw/enterprise-portal`.
- The portal provides browser pages for signup, invite accept, login/callback, bootstrap, channels, and skills.
- The portal backend proxies UX API calls to onboarding + identity services inside cluster.

## Milestones & Sign-off Gates (including UX expansion)

### Milestones 0-9

Completed secure microservice modernization milestones and readiness hardening.

### Milestone 10 — UX Architecture + Contract Baseline

- Deliver UX architecture updates + OpenAPI/AsyncAPI baseline.
- **Unit tests**: contract lint/validation checks.
- **Sign-off**: architecture and contract acceptance.

### Milestone 11 — Signup/Login + Invite UX

- Self-serve signup + invite acceptance UX/backend.
- **Unit tests**: signup validation, invite token lifecycle, session/login wiring.
- **Sign-off**: non-technical signup/login flow approved.

### Milestone 12 — Account Bootstrap Wizard

- Wizard-based tenant/workspace bootstrap and setup state tracking.
- **Unit tests**: wizard transitions, idempotent bootstrap, failure paths.
- **Sign-off**: account bootstrap approved.

### Milestone 13 — All-Channels Provisioning UX

- Unified provisioning orchestrator for supported channels.
- **Unit tests**: per-channel adapter validation and connection verification.
- **Sign-off**: multi-channel setup approved.

### Milestone 14 — Skills Catalog/Install/Configure UX

- ClawHub-backed skill catalog install/config workflows.
- **Unit tests**: install orchestration, config persistence, missing requirements.
- **Sign-off**: skill setup UX approved.

### Milestone 15 — In-Channel Guided Setup UX

- Conversational setup assistant with web wizard state sync.
- **Unit tests**: command routing, authz, state sync.
- **Sign-off**: in-channel onboarding approved.

### Milestone 16 — UX Hardening + Accessibility + E2E Readiness

- A11y pass, failure-recovery UX, full E2E readiness integration.
- **Unit tests**: accessibility and recovery logic.
- **Sign-off**: enterprise UX go/no-go.

### Milestone 17 — Enterprise Web Portal Delivery

- Implement browser-first portal UX and in-cluster deployment wiring.
- **Unit tests**: portal proxy mapping + forwarding.
- **Sign-off**: end-to-end browser onboarding flow runs in local Kubernetes.
