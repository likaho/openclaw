import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import type { OnboardingStore } from "../store.js";

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export const createChannelsRouter = (store: OnboardingStore): Router => {
  const router = createRouter();

  router.get("/catalog", (_req: Request, res: Response) => {
    res.status(200).json({ channels: store.listChannels() });
  });

  router.post("/connections", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (
      typeof body.userId !== "string" ||
      typeof body.channelId !== "string" ||
      typeof body.accountLabel !== "string"
    ) {
      res.status(400).json({ error: "invalid_channel_connection_payload" });
      return;
    }

    const created = store.createChannelConnection(body.userId, body.channelId, body.accountLabel);
    if (!created) {
      res.status(404).json({ error: "channel_not_supported" });
      return;
    }

    res.status(201).json(created);
  });

  router.post("/connections/:connectionId/verify", json(), (req: Request, res: Response) => {
    const connectionId = firstParam(req.params.connectionId);
    const body = req.body as Record<string, unknown>;
    if (!connectionId || typeof body.ok !== "boolean") {
      res.status(400).json({ error: "invalid_channel_verify_payload" });
      return;
    }

    const verified = store.verifyChannelConnection(connectionId, body.ok);
    if (!verified) {
      res.status(404).json({ error: "connection_not_found" });
      return;
    }

    res.status(200).json(verified);
  });

  return router;
};
