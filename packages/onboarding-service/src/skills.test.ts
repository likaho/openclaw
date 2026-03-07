import { describe, expect, test } from "vitest";
import { createInMemoryOnboardingStore } from "./store.js";

describe("skills catalog/install/config", () => {
  test("installs eligible skill and fails when requirements are missing", () => {
    const store = createInMemoryOnboardingStore();

    const ok = store.installSkill("user-1", "calendar");
    expect(ok.status).toBe("completed");

    const failed = store.installSkill("user-1", "homeassistant");
    expect(failed.status).toBe("failed");
    expect(failed.reason).toBe("missing_requirements");
  });

  test("persists per-user skill config", () => {
    const store = createInMemoryOnboardingStore();
    const config = store.configureSkill("user-1", "calendar", true, { TZ: "UTC" });
    expect(config.enabled).toBe(true);
    expect(config.env.TZ).toBe("UTC");
  });
});
