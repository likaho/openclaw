import type { NormalizedEvent } from "./types.js";

export type IngressStore = {
  seenEvent: (eventId: string) => boolean;
  markEventSeen: (eventId: string) => void;
  appendEvent: (event: NormalizedEvent) => void;
  recentEvents: (limit: number) => NormalizedEvent[];
};

export const createInMemoryIngressStore = (): IngressStore => {
  const seen = new Set<string>();
  const events: NormalizedEvent[] = [];

  return {
    seenEvent: (eventId) => seen.has(eventId),
    markEventSeen: (eventId) => {
      seen.add(eventId);
    },
    appendEvent: (event) => {
      events.unshift(event);
      if (events.length > 200) {
        events.length = 200;
      }
    },
    recentEvents: (limit) => events.slice(0, Math.max(0, limit)),
  };
};
