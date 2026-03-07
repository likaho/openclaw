export type IngressChannel = "slack";

export type NormalizedEvent = {
  id: string;
  channel: IngressChannel;
  tenantHint: string;
  actorId: string;
  roomId: string;
  messageText: string;
  sourceTimestamp: string;
  receivedAt: string;
};

export type SlackEventPayload = {
  team_id?: string;
  event_id?: string;
  event_time?: number;
  event?: {
    type?: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
  };
};
