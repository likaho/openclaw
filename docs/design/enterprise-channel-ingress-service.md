# Enterprise Channel Ingress Service (Milestone 4)

This document defines the Milestone 4 Channel Ingress service MVP for webhook ingestion and normalized event output.

## Goals

- Accept inbound channel webhooks through a dedicated service boundary.
- Normalize channel payloads into a canonical event model.
- Enforce basic ingress authentication and idempotency guardrails.
- Prepare channel ingress for event-bus handoff in later milestones.

## Service responsibilities

- Receive channel webhook payloads (MVP starts with Slack message events).
- Validate/authenticate ingress requests.
- Normalize accepted payloads into a shared event shape.
- Drop duplicate events by event ID.
- Expose recent normalized events for local verification.

## Service interface

- OpenAPI contract: `docs/design/enterprise-channel-ingress-service.openapi.yml`
- Persistence mode: in-memory (MVP)
- Current channel coverage: Slack `message` event only

## Normalized event model (MVP)

- `id` (source event id)
- `channel` (e.g., `slack`)
- `tenantHint` (channel tenant/team identifier)
- `actorId`
- `roomId`
- `messageText`
- `sourceTimestamp`
- `receivedAt`

## Milestone 4 sign-off

- Ingress endpoint accepts valid Slack message events.
- Duplicate event IDs are ignored.
- Invalid/unsupported payloads are rejected.
- Ingress auth key is enforced when configured.
- Local Kubernetes smoke verifies normalization + idempotency outcomes.
