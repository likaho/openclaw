## Executive architecture plan: OpenClaw Enterprise UX + Security platform on K8s

### A) Strategic objective

OpenClaw Enterprise must deliver two outcomes together:

- **Secure-by-default multi-tenant architecture** (SSO, policy, isolation, auditability).
- **Non-technical user experience** so users can sign up, login, connect channels, and install skills without operator intervention.

This extends the existing enterprise mode from backend microservices into a full product experience layer.

---

## B) Target platform decomposition

### Core platform services

1. Edge/API Gateway Service
2. Identity Service (OIDC/SAML broker)
3. Tenant & Org Service
4. Authorization/Policy Service
5. Channel Ingress/Adapter Service
6. Conversation/Memory Service
7. Orchestration Service
8. Skill Control Plane
9. Skill Runtime Plane (Node/Python)
10. Provider Proxy Service
11. Audit & Observability Service

### New enterprise UX services

12. **Enterprise Web Portal**

- Non-technical admin/user UI for onboarding, channels, skills, and setup progress.

13. **Onboarding Experience Service**

- Self-serve signup, invite acceptance, onboarding wizard state.

14. **Account Setup API**

- Tenant/workspace bootstrap and default profile templates.

15. **Channel Provisioning Orchestrator**

- Unified channel connector flow (OAuth/token/QR/password) with per-channel adapters.

16. **Skills Catalog & Install API**

- ClawHub-backed browsing/install/configure with eligibility/missing-requirement hints.

17. **Credential Broker**

- SecretRef/Vault mediation so browser and channel clients never receive raw secret material.

18. **User Notification Service**

- Email/in-app notifications for verification, invite status, setup progress, and failures.

19. **Channel Setup Assistant**

- In-channel guided setup UX for WhatsApp/Telegram/Slack and compatible behavior for other channels.

---

## C) Security model updates for UX

- Signup/invite workflows are policy-governed and tenant-scoped.
- Credential entry is routed through credential broker abstractions only.
- Setup assistant commands require explicit authorization and emit audit events.
- UI actions map to immutable onboarding/channel/skill lifecycle events.

---

## D) Interface contracts for UX expansion

### REST contracts (OpenAPI)

- `POST /v1/onboarding/signup`
- `POST /v1/onboarding/invite/accept`
- `POST /v1/onboarding/bootstrap`
- `GET /v1/onboarding/wizard-state/{userId}`
- `POST /v1/onboarding/wizard-state`
- `GET /v1/channels/catalog`
- `POST /v1/channels/connections`
- `POST /v1/channels/connections/{id}/verify`
- `GET /v1/skills/catalog`
- `POST /v1/skills/install`
- `POST /v1/skills/{skillKey}/configure`
- `POST /v1/onboarding/setup/complete`

### Event contracts (AsyncAPI)

- `onboarding.user.created`
- `onboarding.tenant.bootstrapped`
- `channel.connection.created|verified|failed`
- `skill.install.started|completed|failed`

---

## E) Delivery roadmap extension (post-M9)

- Milestone 10: UX architecture + contract baseline
- Milestone 11: Signup/login + invite UX
- Milestone 12: Account bootstrap wizard
- Milestone 13: All-channel provisioning UX
- Milestone 14: Skills catalog/install/configure UX
- Milestone 15: In-channel guided setup UX
- Milestone 16: UX hardening, accessibility, E2E readiness

Each milestone requires unit tests, deployment smoke, and numbered completion docs.
