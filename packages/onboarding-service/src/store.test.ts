import { describe, expect, test } from "vitest";
import { createInMemoryOnboardingStore } from "./store.js";

describe("onboarding store", () => {
  test("handles self-serve and invite user creation with invite lifecycle", () => {
    const store = createInMemoryOnboardingStore();

    const invite = store.createInvite("invitee@example.com", "tenant-a");
    const accepted = store.acceptInvite(invite.token);
    expect(accepted?.email).toBe("invitee@example.com");
    expect(store.acceptInvite(invite.token)).toBeUndefined();

    const selfServe = store.createUser("alice@example.com", "Alice", "self-serve");
    const invited = store.createUser("invitee@example.com", "Invitee", "invite");

    expect(store.getUser(selfServe.userId)?.signupMode).toBe("self-serve");
    expect(store.getUser(invited.userId)?.signupMode).toBe("invite");
  });

  test("bootstraps tenant idempotently and tracks setup completion", () => {
    const store = createInMemoryOnboardingStore();
    const user = store.createUser("owner@example.com", "Owner", "self-serve");

    const first = store.createTenantBootstrap("tenant-a", "default", user.userId, "starter");
    const second = store.createTenantBootstrap("tenant-a", "another", user.userId, "regulated");
    expect(second.workspaceId).toBe(first.workspaceId);
    expect(second.profile).toBe(first.profile);

    const done = store.completeSetup(user.userId, "tenant-a", "default");
    expect(done.tenantId).toBe("tenant-a");
    expect(store.listEvents().some((event) => event.eventType === "setup.completed")).toBe(true);
  });

  test("stores and reads wizard state", () => {
    const store = createInMemoryOnboardingStore();

    store.setWizardState({
      userId: "user-1",
      stage: "channels",
      completedSteps: ["signup", "login"],
      updatedAt: new Date().toISOString(),
    });

    const state = store.getWizardState("user-1");
    expect(state?.stage).toBe("channels");
    expect(state?.completedSteps).toEqual(["signup", "login"]);
  });
});
