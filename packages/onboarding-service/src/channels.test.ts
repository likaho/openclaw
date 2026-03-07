import { describe, expect, test } from "vitest";
import { createInMemoryOnboardingStore } from "./store.js";

describe("channel provisioning", () => {
  test("exposes all-channel catalog including whatsapp/telegram/slack", () => {
    const store = createInMemoryOnboardingStore();
    const ids = store.listChannels().map((entry) => entry.channelId);
    expect(ids).toContain("whatsapp");
    expect(ids).toContain("telegram");
    expect(ids).toContain("slack");
    expect(ids).toContain("msteams");
  });

  test("creates and verifies channel connection status", () => {
    const store = createInMemoryOnboardingStore();
    const connection = store.createChannelConnection("user-1", "whatsapp", "primary");
    expect(connection?.status).toBe("pending");

    const verified = store.verifyChannelConnection(connection!.connectionId, true);
    expect(verified?.status).toBe("verified");

    const failed = store.verifyChannelConnection(connection!.connectionId, false);
    expect(failed?.status).toBe("failed");
  });
});
