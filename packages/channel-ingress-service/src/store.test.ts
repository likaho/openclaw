import { describe, expect, it } from "vitest";
import { createInMemoryIngressStore } from "./store.js";

describe("ingress store", () => {
  it("tracks seen events and recency order", () => {
    const store = createInMemoryIngressStore();
    expect(store.seenEvent("e1")).toBe(false);
    store.markEventSeen("e1");
    expect(store.seenEvent("e1")).toBe(true);

    store.appendEvent({
      id: "e1",
      channel: "slack",
      tenantHint: "T1",
      actorId: "U1",
      roomId: "C1",
      messageText: "first",
      sourceTimestamp: "1",
      receivedAt: "1",
    });
    store.appendEvent({
      id: "e2",
      channel: "slack",
      tenantHint: "T1",
      actorId: "U1",
      roomId: "C1",
      messageText: "second",
      sourceTimestamp: "2",
      receivedAt: "2",
    });

    const events = store.recentEvents(2);
    expect(events[0]?.id).toBe("e2");
    expect(events[1]?.id).toBe("e1");
  });
});
