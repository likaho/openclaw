# Enterprise Skill Control Service (Milestone 6)

This document defines the Milestone 6 Skill Control service MVP for artifact intake, admission checks, and rollout policy recording.

## Goals

- Accept skill artifact metadata from Clawhub-like sources.
- Verify artifact signatures before admission evaluation.
- Evaluate tenant-scoped admission policy (runtime, capability, trust list).
- Record rollout intents for dev/canary/general stages.

## Service responsibilities

- Manage tenant skill policy documents.
- Ingest and store skill artifact metadata.
- Validate signatures and enforce admission policy.
- Register rollout records for admitted artifacts.

## Service interface

- OpenAPI contract: `docs/design/enterprise-skill-control-service.openapi.yml`
- Persistence mode: in-memory (MVP)

## Admission and rollout model (MVP)

- Signature:
  - HMAC SHA-256 validation over canonical artifact identity fields.
- Admission checks:
  - tenant policy must exist
  - skill id must be trusted for the tenant
  - runtime must be allowed
  - capability profile must be allowed
- Rollout stages:
  - `dev`
  - `canary` (`canaryPercent` required: `1..50`)
  - `general`

## Milestone 6 sign-off

- Signature validation tests pass.
- Admission allow/deny tests pass.
- Rollout validation tests pass.
- Local Kubernetes smoke verifies policy -> artifact intake -> rollout flow.
