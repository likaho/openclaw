# Enterprise Policy Service (Milestone 3)

This document defines the Milestone 3 Policy service MVP for centralized authorization decisions (RBAC + ABAC).

## Goals

- Provide a central authorization decision API.
- Enforce strict cross-tenant deny behavior.
- Enforce default-deny when no explicit allow rule exists.
- Support entitlement-gated actions as ABAC constraints.

## Service responsibilities

- Store tenant-scoped authorization policy definitions.
- Evaluate authorization decisions for `subject + action + resource`.
- Return deterministic `allow/deny` responses with machine-readable reasons.

## Service interface

- OpenAPI contract: `docs/design/enterprise-policy-service.openapi.yml`
- Persistence mode: in-memory (MVP)

## Authorization model (MVP)

- RBAC:
  - role permissions map (`role -> actions[]`)
  - wildcard action `*` support for admin-style roles
- ABAC:
  - optional action-to-entitlement requirements (`action -> required entitlement`)
- Guardrails:
  - deny cross-tenant access
  - deny when tenant policy is missing
  - deny when role permission is missing
  - deny when required entitlement is missing

## Milestone 3 sign-off

- Allow/deny matrix tests pass.
- Default-deny behavior is validated.
- Cross-tenant deny behavior is validated.
- Local Kubernetes smoke verifies policy create + decision endpoints.
