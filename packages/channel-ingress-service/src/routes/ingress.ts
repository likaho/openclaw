import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import type { ChannelIngressConfig } from "../config.js";
import { normalizeSlackEvent } from "../normalize.js";
import type { IngressStore } from "../store.js";
import type { SlackEventPayload } from "../types.js";

const parseLimit = (value: unknown): number => {
  if (typeof value !== "string") {
    return 20;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
};

const authorize = (req: Request, config: ChannelIngressConfig): boolean => {
  if (!config.ingressApiKey) {
    return true;
  }
  const header = req.header("x-openclaw-ingress-key");
  return header === config.ingressApiKey;
};

export const createIngressRouter = (config: ChannelIngressConfig, store: IngressStore): Router => {
  const router = createRouter();

  router.post("/slack/events", json(), (req: Request, res: Response) => {
    if (!authorize(req, config)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const payload = req.body as SlackEventPayload;
    const normalized = normalizeSlackEvent(payload);
    if (!normalized) {
      res.status(400).json({ error: "unsupported_or_invalid_event" });
      return;
    }
    if (store.seenEvent(normalized.id)) {
      res.status(200).json({ status: "duplicate_ignored", id: normalized.id });
      return;
    }
    store.markEventSeen(normalized.id);
    store.appendEvent(normalized);
    res.status(202).json({ status: "accepted", id: normalized.id });
  });

  router.get("/events", (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit);
    res.status(200).json({ events: store.recentEvents(limit) });
  });

  return router;
};
