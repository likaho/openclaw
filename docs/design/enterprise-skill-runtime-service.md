# Enterprise Skill Runtime Service (Milestone 7)

This document defines the Milestone 7 Skill Runtime service MVP for Node/Python execution pools with runtime guardrails.

## Goals

- Provide separate runtime execution paths for Node and Python jobs.
- Enforce capability profile allowlist checks before execution.
- Enforce timeout and memory guardrails per job.
- Provide runtime pool status for operational visibility.

## Service responsibilities

- Accept runtime execution jobs.
- Validate runtime, capability, timeout, and memory constraints.
- Execute job in corresponding runtime pool (MVP simulated execution path).
- Record job lifecycle status and expose pool metrics.

## Service interface

- OpenAPI contract: `docs/design/enterprise-skill-runtime-service.openapi.yml`
- Persistence mode: in-memory (MVP)
- Runtime support: `node`, `python`

## Runtime model (MVP)

- Job states:
  - `queued`
  - `running`
  - `succeeded`
  - `failed`
  - `rejected`
- Guardrails:
  - runtime must be supported
  - capability profile must be allowlisted
  - timeout and memory must be within configured limits
- Pool status:
  - active job count
  - completed job count
  - failed/rejected job count

## Milestone 7 sign-off

- Runtime bootstrap and pool status tests pass.
- Timeout/memory/capability enforcement tests pass.
- Node and Python execution paths both validated in local smoke.
- Local Kubernetes smoke verifies runtime execution and guardrail enforcement.
