### ✅ Goals, deliverables, success criteria
- **Goal**: Re-architect OpenClaw into an enterprise-ready, multi-tenant microservices platform that preserves the existing product surface while adding SSO, higher security, and elastic scalability.
- **Deliverables**: Service-boundary blueprint, SSO + tenancy model, Clawhub skill deployment design (Node.js & Python), Kubernetes deployment reference, phased migration roadmap, and a cross-service testing strategy with high-level unit-test coverage targets.
- **Success criteria**: Each service exposes a stable contract (OpenAPI/AsyncAPI), enforces tenant isolation, integrates with centralized authz, can be scaled and upgraded independently, and meets ≥85% unit-test coverage (≥95% for auth/policy code). Skills run in sandboxed runtimes with signed artifacts from Clawhub, zero-trust networking is enforced, and CI gates include contract/coverage/security checks.

---

## 1. Target service architecture (repo-root references)
| Service | Responsibility | Notes / Source seeds |
| --- | --- | --- |
| **Edge/API Gateway** | Ingress, WAF, rate limits, JWT verification, tenant headers | Sits in front of existing `src/cli`, `src/commands` HTTP surfaces; introduces `/v2/tenant/*` routes |
| **Identity & SSO Service** | OIDC-first + SAML login, SCIM hooks, token minting | New service; leverages `docs/security/` policies and issues tokens containing `tenant_id`, `workspace_id`, `roles` |
| **Tenant Management Service** | Org/tenant/workspace lifecycle, quotas, feature flags | Wraps data now scattered across `src/routing`, `src/channels` configs |
| **Policy/Authorization Service** | Central PD(P) using OPA/Cedar, RBAC + ABAC decisions | Shared SDK consumed by every other service |
| **Channel Ingress Service** | Slack/Discord/Telegram/etc adapters, webhook ingest | Extracts logic from `src/telegram`, `src/slack`, `src/discord`, `extensions/*` |
| **Conversation & Memory Service** | Session state, memory search, retention, deletion | Moves logic under `src/media`, `src/memory` into isolated data service |
| **Orchestration Service** | Agent run lifecycle, tool call sequencing, async workflows | Coordinates between channel events and skill runs via event bus |
| **Skill Control Plane** | Skill registry, Clawhub artifact verification, rollout policy | Interfaces with Clawhub repo and metadata; stores manifests |
| **Skill Runtime Plane (Node & Python pools)** | Sandboxed execution with capability profiles and audit | Two deployment types: `skill-runner-node`, `skill-runner-python`; gVisor/Kata + seccomp |
| **Provider Proxy Service** | Centralized LLM/provider access, secrets isolation, cost tracking | Abstracts provider credentials out of skills/agents |
| **Audit & Observability Service** | Immutable audit log, metrics, traces, compliance exports | Aggregates data from all services, integrates with SIEM |

All services communicate over a zero-trust mesh (mTLS, SPIFFE IDs) and publish AsyncAPI contracts for event flows.

---

## 2. Multi-tenant + SSO model
1. **Tenant context**: `tenant_id`, `workspace_id`, `subject`, `roles`, `entitlements` embedded in JWT and propagated via signed headers.
2. **SSO broker**: per-tenant IdP configuration with domain discovery. Supports OIDC and SAML; MFA and conditional-access claims map to internal policy attributes.
3. **Tenant tiers**: shared DB + RLS (default), schema-per-tenant (regulated), DB-per-tenant (high isolation). Encryption via tenant-specific KMS keys; secrets via External Secrets + Vault/cloud KMS.
4. **Policy enforcement**: every service defers allow/deny to the policy service, never trusting edge-only auth; per-tenant rate limits + quotas enforced at gateway + orchestration layers.

---

## 3. Clawhub skill deployment (Node.js + Python)
### Control plane flow
1. Tenant (or OpenClaw ops) selects Clawhub skill version.
2. Skill metadata fetched, signature + SBOM verified, dependencies scanned (SCA/Malware).
3. Admission policy evaluates runtime, permissions, tenant allowlist.
4. Rollout staged (dev → canary tenant → general).

### Runtime plane
- Dedicated runner deployments: `skill-runner-node` and `skill-runner-python`.
- Pod security: non-root UID, read-only root fs, tmpfs scratch, seccomp/AppArmor, no hostPath.
- Capability profiles (e.g., `no-network`, `http-readonly`, `tenant-api-only`). NetworkPolicy enforces egress allowlists.
- Execution limits: CPU/memory quotas, execution timeout, budget tracking.
- Full audit trail: skill version, invoking tenant/workspace, policy decision hash, runtime metrics.

---

## 4. Kubernetes deployment blueprint
- **Namespaces** per environment (`prod`, `staging`, `dev`), optional dedicated namespace for regulated tenants.
- **Service mesh** (Istio/Linkerd) for mTLS, retries, circuit-breaking.
- **Ingress** via gateway controller + WAF; cert-manager for TLS. External DNS for tenant subdomains.
- **Stateful backing services**: Managed Postgres (PITR + replicas), Redis, Kafka/NATS. Object storage (S3/GCS) for artifacts/memory snapshots.
- **Security**: Pod Security Standards (restricted), Kyverno/Gatekeeper enforcing signed images (cosign). Workload Identity or SPIRE for service-to-service auth.
- **Scalability**: HPA + KEDA (event-driven scaling), VPA recommendations, Cluster Autoscaler. PodDisruptionBudgets + topology spread constraints.
- **GitOps**: Helm charts per service with Kustomize overlays; ArgoCD/Flux manages environments.

---

## 5. Migration roadmap (strangler pattern)
1. **Phase 0 – Foundations (2–4 wks)**
   - Define canonical tenant/auth headers; add tracing/log correlation IDs to current monolith.
   - Document service contracts (OpenAPI/AsyncAPI) before extraction.
2. **Phase 1 – Edge + Identity (4–8 wks)**
   - Deploy API Gateway, Identity/SSO, and Tenant services.
   - Front existing HTTP endpoints via gateway while monolith still handles downstream logic.
3. **Phase 2 – Channel + Orchestration (4–8 wks)**
   - Extract channel adapters + webhook ingest; introduce event bus + orchestrator bridging to monolith logic via compatibility API.
4. **Phase 3 – Skill Planes (6–10 wks)**
   - Launch skill control plane + Node/Python runners; migrate Clawhub-managed skills into sandboxed exec path.
5. **Phase 4 – Data & Provider separation (6–10 wks)**
   - Extract conversation/memory storage and provider proxy. Apply tenant storage tiering and per-tenant encryption.
6. **Phase 5 – Hardening + SLOs (ongoing)**
   - Chaos/resilience, compliance automation, autoscaling tuning, observability maturity.

Each phase keeps CLI and current channels operational via compatibility shims until service reaches parity.

---

## 6. Testing & quality gates (high-level coverage)
| Layer | Scope | Target |
| --- | --- | --- |
| Unit tests | Core logic, policy evaluation, tenant checks | ≥85% lines/branches overall; ≥95% for Identity/Policy/Skill control code |
| Contract tests | OpenAPI/AsyncAPI schemas, backward compatibility | Fail build on breaking change |
| Integration tests | Service-to-DB/cache/bus interactions using ephemeral env | Cover all CRUD and failure paths |
| Security tests | Authz bypass attempts, tenant bleed, token misuse, skill sandbox escapes | Automated suite + manual red-team scenarios |
| E2E tests | SSO → tenant message → skill run → audit verification | Multi-tenant fixtures + mocked IdP |
| Resilience/chaos | Pod kill, queue lag, DB failover | Weekly chaos runs with defined SLO guardrails |
| Performance | p95/p99 latency, autoscaling triggers, per-tenant quotas | Load tests per service, focus on noisy neighbor isolation |

CI gates: coverage thresholds, policy regression suite, SAST/SCA clean, contract compatibility, supply-chain checks (cosign verify, SBOM diff).

---

## 7. Immediate backlog (first 8–10 weeks)
1. Canonical tenant/auth context spec + shared middleware library.
2. Identity/SSO service MVP (OIDC) + tenant-to-IdP mapping UI/API.
3. Tenant service MVP with quotas + feature flags.
4. Policy service MVP + SDK consumed by monolith (bridge mode).
5. Channel ingress refactor to event bus with canonical event schema.
6. Skill control plane skeleton + signed artifact verification path from Clawhub.
7. Node/Python runner prototypes with sandbox hardening + audit logging.
8. Enterprise E2E test harness (mock IdP + multi-tenant fixtures).

---

### Next steps
- Align stakeholders on phase timeline + resource owners per service.
- Begin detailed design docs for Phases 1–2 (service APIs, datastore choices, data migration plan).
- Stand up shared platform infra (mesh, GitOps, observability) before cutting services over.

Let me know when you’d like implementation-ready docs (API specs, Helm skeletons, CI templates) or deeper dives into any service. 
