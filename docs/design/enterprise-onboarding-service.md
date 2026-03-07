# Enterprise Onboarding Service

## Purpose

Enterprise onboarding service powers non-technical setup UX:

- self-serve signup and invite acceptance
- onboarding wizard progression and account bootstrap
- all-channel provisioning metadata and verification lifecycle
- skills catalog/install/configure orchestration for first-run setup

## Endpoints

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

## Contracts

- OpenAPI: `docs/design/enterprise-onboarding-ux.openapi.yml`
- AsyncAPI: `docs/design/enterprise-onboarding-events.asyncapi.yml`

## Local deployment

- Manifest: `deploy/k8s/local/onboarding-service.yaml`
- Service port: `4010`

## Event model

Service emits onboarding lifecycle and setup event topics:

- `onboarding.user.created`
- `onboarding.tenant.bootstrapped`
- `channel.connection.created|verified|failed`
- `skill.install.started|completed|failed`
