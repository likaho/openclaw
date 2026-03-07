import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const openapi = readFileSync("../../docs/design/enterprise-onboarding-ux.openapi.yml", "utf-8");
const asyncapi = readFileSync(
  "../../docs/design/enterprise-onboarding-events.asyncapi.yml",
  "utf-8",
);

describe("enterprise onboarding contracts", () => {
  test("contains required onboarding endpoints", () => {
    expect(openapi).toContain("/v1/onboarding/signup");
    expect(openapi).toContain("/v1/onboarding/invite/accept");
    expect(openapi).toContain("/v1/onboarding/bootstrap");
    expect(openapi).toContain("/v1/onboarding/wizard-state/{userId}");
    expect(openapi).toContain("/v1/channels/catalog");
    expect(openapi).toContain("/v1/channels/connections/{id}/verify");
    expect(openapi).toContain("/v1/skills/catalog");
    expect(openapi).toContain("/v1/skills/install");
    expect(openapi).toContain("/v1/skills/{skillKey}/configure");
    expect(openapi).toContain("/v1/onboarding/setup/complete");
  });

  test("contains required onboarding async events", () => {
    expect(asyncapi).toContain("onboarding.user.created");
    expect(asyncapi).toContain("onboarding.tenant.bootstrapped");
    expect(asyncapi).toContain("channel.connection.created");
    expect(asyncapi).toContain("channel.connection.verified");
    expect(asyncapi).toContain("channel.connection.failed");
    expect(asyncapi).toContain("skill.install.started");
    expect(asyncapi).toContain("skill.install.completed");
    expect(asyncapi).toContain("skill.install.failed");
  });
});
