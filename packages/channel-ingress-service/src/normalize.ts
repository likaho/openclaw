import type { NormalizedEvent, SlackEventPayload } from "./types.js";

export const normalizeSlackEvent = (payload: SlackEventPayload): NormalizedEvent | undefined => {
  if (!payload.event_id || !payload.team_id || !payload.event) {
    return undefined;
  }
  if (payload.event.type !== "message") {
    return undefined;
  }
  if (
    typeof payload.event.user !== "string" ||
    typeof payload.event.channel !== "string" ||
    typeof payload.event.text !== "string" ||
    payload.event.text.length === 0
  ) {
    return undefined;
  }

  const sourceTimestamp =
    typeof payload.event.ts === "string"
      ? payload.event.ts
      : String(payload.event_time ?? Date.now());

  return {
    id: payload.event_id,
    channel: "slack",
    tenantHint: payload.team_id,
    actorId: payload.event.user,
    roomId: payload.event.channel,
    messageText: payload.event.text,
    sourceTimestamp,
    receivedAt: new Date().toISOString(),
  };
};
