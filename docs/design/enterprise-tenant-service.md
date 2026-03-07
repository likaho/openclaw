# Enterprise Tenant Service (Milestone 2)

This document defines the Milestone 2 Tenant service MVP for tenant/workspace lifecycle and tenant policy/quota metadata.

## Goals

- Provide tenant CRUD APIs for org onboarding.
- Provide workspace CRUD APIs scoped by tenant.
- Store and validate tenant quotas and policy assignments.
- Enforce tenant boundary on workspace lookups.

## Service responsibilities

- Create and update tenant records.
- Maintain tenant quotas (`maxWorkspaces`, `maxMonthlyMessages`).
- Maintain tenant feature flags and policy list.
- Create and resolve workspaces under a tenant boundary.

## Service interface

- OpenAPI contract: `docs/design/enterprise-tenant-service.openapi.yml`
- Current persistence mode: in-memory (MVP)

## Validation rules (MVP)

- Tenant `id` and `name` are required.
- Quotas must be positive integers.
- Policy list must not contain duplicates.
- Workspace lookup is always scoped by tenant (`tenantId` + `workspaceId`).

## Milestone 2 sign-off

- Tenant CRUD endpoints return expected status codes.
- Workspace resolution respects tenant isolation.
- Quota and policy validation errors are enforced by API tests.
