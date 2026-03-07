# Enterprise Orchestration Service (Milestone 5)

This document defines the Milestone 5 Orchestration service MVP for workflow lifecycle orchestration.

## Goals

- Manage workflow lifecycle transitions for agent/tool/skill runs.
- Provide idempotent workflow creation by tenant + dedupe key.
- Implement retry scheduling behavior with exponential backoff.
- Expose workflow state for local integration verification.

## Service responsibilities

- Create workflows in queued state.
- Advance workflows through lifecycle transitions.
- Enforce valid transition events and default-safe behavior.
- Schedule retry windows before final failure.

## Service interface

- OpenAPI contract: `docs/design/enterprise-orchestration-service.openapi.yml`
- Persistence mode: in-memory (MVP)

## Workflow model (MVP)

- States:
  - `queued`
  - `running`
  - `retrying`
  - `succeeded`
  - `failed`
- Transition events:
  - `start`
  - `success`
  - `failure`
- Retry behavior:
  - exponential backoff (`1s`, `2s`, `4s`, ...)
  - capped retry delay
  - transitions to `failed` when max attempts exhausted

## Milestone 5 sign-off

- Workflow lifecycle state transitions are verified.
- Retry/backoff behavior is verified.
- Idempotent creation via dedupe key is verified.
- Local Kubernetes smoke verifies create + transition flows end-to-end.
