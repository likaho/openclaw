# Enterprise Conversation Service

## Purpose

Milestone 8 introduces a single service surface that covers:

- tenant-isolated conversation memory storage with retention controls
- provider proxy policy enforcement with tenant key references
- immutable audit stream for traceability and integrity verification

## Runtime behavior

- Every memory entry is partitioned by `tenantId + conversationId`.
- Retention is enforced at read time by pruning expired entries.
- Provider proxy calls require both:
  - provider allowed globally and for the tenant
  - provider key reference configured for tenant/provider pair
- Audit events are append-only and hash chained (`previousHash` -> `hash`).
- Audit verification checks sequence continuity and hash correctness.

## API endpoints

- `POST /v1/conversations/memory/entries`
- `GET /v1/conversations/memory/{tenantId}/{conversationId}`
- `POST /v1/providers/proxy`
- `POST /v1/audit/events`
- `GET /v1/audit/events/{tenantId}`
- `GET /v1/audit/verify/{tenantId}`

## Configuration

- `PORT` (default: `4008`)
- `CONVERSATION_DEFAULT_RETENTION_DAYS` (default: `30`)
- `CONVERSATION_MAX_RETENTION_DAYS` (default: `365`)
- `PROVIDER_ALLOWED_LIST` (default: `openai,anthropic`)
- `TENANT_PROVIDER_POLICY` (example: `tenant-a:openai|anthropic;tenant-b:openai`)
- `TENANT_PROVIDER_KEY_REFS` (example: `tenant-a:openai=vault://tenant-a/openai`)

## Security notes

- No provider API key material is stored in this service; only key references are returned.
- Audit events are immutable by API design (append/list/verify only).
- Integrity verification can be used in readiness checks and compliance workflows.
