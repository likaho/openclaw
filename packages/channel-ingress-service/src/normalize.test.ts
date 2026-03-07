import { describe, expect, it } from "vitest";
import { normalizeSlackEvent } from "./normalize.js";

describe("normalizeSlackEvent", () => {
  it("normalizes valid slack message event", () => {
    const normalized = normalizeSlackEvent({
      team_id: "T001",
      event_id: "Ev001",
      event: {
        type: "message",
        user: "U001",
        channel: "C001",
        text: "hello",
        ts: "1731000000.001",
      },
    });

    expect(normalized).toMatchObject({
      id: "Ev001",
      channel: "slack",
      tenantHint: "T001",
      actorId: "U001",
      roomId: "C001",
      messageText: "hello",
      sourceTimestamp: "1731000000.001",
    });
  });

  it("rejects non-message event", () => {
    expect(
      normalizeSlackEvent({
        team_id: "T001",
        event_id: "Ev001",
        event: { type: "member_joined_channel" },
      }),
    ).toBeUndefined();
  });
});
