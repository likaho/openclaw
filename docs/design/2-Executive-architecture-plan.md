## Executive architecture plan: OpenClaw → multi-tenant microservices on K8s

### A) Key design adjustment from current trust model
Today OpenClaw’s documented model is primarily **single trusted operator per gateway**, not adversarial multi-tenant. For enterprise SSO + multi-tenant, the migration must explicitly introduce:
- hard tenant authorization boundaries,
- data isolation controls,
- service identity and zero-trust network enforcement,
- policy-governed skill execution isolation.

This becomes a **new deployment profile** (enterprise mode), while preserving legacy single-operator mode for existing users.

---

## B) Target microservices decomposition

### 1. Edge/API Gateway Service
- External ingress, WAF, global rate limits
- JWT verification, tenant context propagation
- API versioning + routing to internal services

### 2. Identity Service (SSO Broker)
- OIDC-first, SAML support for enterprise IdPs
- Tenant-specific IdP config mapping
- Session/token minting and refresh
- SCIM provisioning hooks (optional)

### 3. Tenant & Org Service
- Tenant/workspace lifecycle
- Role mapping, policy assignment, quotas
- Feature flags and compliance profile per tenant

### 4. Authorization/Policy Service
- Central policy decision point (RBAC + ABAC)
- OPA/Cedar-backed decisions
- Enforces tenant boundary and skill permissions

### 5. Channel Ingress/Adapter Service
- Unified ingress for Slack/Discord/Telegram/etc.
- Converts platform events to canonical internal events
- Applies tenant mapping and channel auth checks

### 6. Conversation/Memory Service
- Session state, memory index, retrieval metadata
- Strict tenant/workspace partitioning
- Retention, legal hold, delete workflows

### 7. Orchestration Service
- Agent run lifecycle orchestration
- Tool call mediation and policy checks
- Async workflow steps via event bus

### 8. Skill Control Plane
- Skill registry metadata and versioning
- Clawhub artifact intake, signature and provenance verification
- Policy admission (runtime type, network/fs/cpu constraints)

### 9. Skill Runtime Plane
- Separate runtime pools:
  - `skill-runner-node`
  - `skill-runner-python`
- Sandboxed execution (restricted pods, seccomp, non-root, read-only fs)
- Per-tenant quotas and network egress allowlists

### 10. Provider Proxy Service
- Centralized LLM/provider access abstraction
- Per-tenant key refs and usage controls
- Cost accounting and policy guardrails

### 11. Audit & Observability Service
- Immutable tenant-aware audit log
- Metrics/tracing/log pipeline and SIEM forwarding
- Compliance evidence exports

---

## C) Kubernetes reference architecture

### Cluster/security baseline
- Namespaces by env (`prod`, `staging`), optional regulated tenant partitions
- Service mesh (Istio/Linkerd): mTLS, traffic policy, retries, circuit-breaking
- NetworkPolicy default deny everywhere
- Pod Security Standards: `restricted`
- Workload Identity (no long-lived static cloud creds)
- External Secrets + KMS/Vault for secret material

### Reliability/scalability baseline
- HPA for stateless services, VPA recommendations where safe
- PDB + anti-affinity for critical services
- Event bus (Kafka/NATS) for decoupled processing
- Redis for short-lived coordination/cache
- Managed Postgres with PITR + replicas + backup policy

### Delivery/GitOps
- Helm chart per service + env overlays
- ArgoCD/Flux continuous reconciliation
- Signed images + admission policies (Kyverno/Gatekeeper + cosign verify)

---

## D) Multi-tenant data and auth model

- Canonical identity claims: `tenant_id`, `workspace_id`, `subject`, `roles`, `entitlements`
- Every service enforces authz using policy service (never trust edge-only auth)
- Isolation options by tier:
  1) shared DB + row-level security,
  2) schema-per-tenant,
  3) DB-per-tenant (regulated)
- Per-tenant encryption contexts/keys via KMS
- Tenant-scoped rate limits/quotas for noisy-neighbor control

---

## E) SSO design for enterprise login

- Tenant-admin configures IdP metadata (OIDC/SAML)
- Domain/tenant discovery at login
- JIT user provisioning + optional SCIM sync
- Group/claim mapping → internal roles
- Enforce MFA/conditional-access trust from upstream IdP
- Short-lived JWT + rotating refresh tokens; service tokens via workload identity

---

## F) Clawhub skill deployment model (Node.js + Python)

### Control plane flow
1. Tenant selects skill version from Clawhub
2. Skill package metadata fetched
3. Verify signature/provenance + dependency scan (SCA)
4. Store immutable artifact manifest + SBOM pointer
5. Evaluate admission policy (tenant + runtime capability profile)
6. Approve rollout (global/tenant/canary)

### Runtime flow
- Skill invocation sent to runtime scheduler
- Scheduler picks Node or Python runner pool
- Runner executes with capability profile:
  - e.g., `no-network`, `tenant-api-only`, `readonly-http`
- Ephemeral identity token injected with tenant scope
- Result returned via event bus + orchestration service

### Security controls
- No hostPath mounts for skill pods
- Read-only filesystem + tmpfs scratch only
- Egress deny by default, allowlist per skill class
- Hard execution timeout and memory/CPU caps
- Full audit trail: who invoked which skill version under which tenant

---

## G) Migration roadmap (strangler pattern)

### Phase 0 (2–4 weeks): Foundations
- Define service contracts (OpenAPI/AsyncAPI)
- Add distributed tracing to monolith
- Introduce canonical tenant/auth context headers

### Phase 1 (4–8 weeks): Identity/Tenant first
- Deploy API gateway + identity + tenant services
- Add SSO and tenant-aware authn/authz
- Keep existing core logic behind compatibility layer

### Phase 2 (4–8 weeks): Channel and orchestration extraction
- Move channel ingress to dedicated service
- Introduce event bus and async processing

### Phase 3 (6–10 weeks): Skill planes extraction
- Build skill control plane + runtime pools (Node/Python)
- Integrate Clawhub verification and policy admission

### Phase 4 (6–10 weeks): Data and provider separation
- Extract conversation/memory and provider proxy services
- Implement tenant-tier isolation strategy options

### Phase 5 (ongoing): hardening + SLO optimization
- Chaos/perf tuning, tenancy scaling, compliance automation

---

## H) Testing strategy (high-level coverage across all services)

### Coverage goals
- Unit: **>=85% lines/branches** per service
- Critical security and policy modules: **>=95%**

### Test layers per service
1. **Unit tests**
   - business logic, policy evaluation, tenant guards
2. **Contract tests**
   - OpenAPI/AsyncAPI compatibility and backward checks
3. **Integration tests**
   - Postgres/Redis/bus interactions using ephemeral test env
4. **Security tests**
   - authz bypass attempts, tenant data bleed, token misuse, sandbox escape regressions
5. **E2E tests**
   - SSO login → tenant-scoped message → skill invoke → audit verification
6. **Resilience tests**
   - service outages, queue lag, failover behavior
7. **Performance tests**
   - tenant fairness, p95/p99 latency, autoscaling reactions

### CI quality gates
- fail build on coverage threshold breach
- fail on critical SAST/SCA findings
- fail on contract compatibility breaks
- fail on policy regression suite failures

---

## I) Suggested first implementation backlog (top priority)
1. Enterprise auth context spec (`tenant/workspace/subject/roles`) and middleware package
2. Identity service MVP with OIDC and tenant mapping
3. Tenant service MVP (org/tenant/workspace CRUD + quota model)
4. Policy service MVP + shared authorization SDK
5. Channel ingress canonical event schema and bus integration
6. Skill control plane MVP + signed artifact verification from Clawhub
7. Node/Python skill-runner prototypes with sandbox hardening profile
8. End-to-end enterprise test harness with mocked IdP and multi-tenant fixtures

If you’re happy with this plan, please **toggle to Act mode** and I’ll turn this into an implementation-ready package: concrete service boundaries mapped to current directories, API contracts, Helm chart skeleton, and CI test matrix templates.
 
