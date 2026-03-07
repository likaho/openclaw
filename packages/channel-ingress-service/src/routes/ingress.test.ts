import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import type { ChannelIngressConfig } from "../config.js";
import { createInMemoryIngressStore } from "../store.js";
import { createIngressRouter } from "./ingress.js";

type Handler = (req: Request, res: Response) => void;
type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

const createMockResponse = (): MockResponse => {
  const response: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return response;
};

const findHandler = (
  path: "/slack/events" | "/events",
  method: "post" | "get",
  config: ChannelIngressConfig = { port: 0 },
): Handler => {
  const store = createInMemoryIngressStore();
  const router = createIngressRouter(config, store);
  const layer = router.stack.find(
    (entry) =>
      "route" in entry &&
      entry.route?.path === path &&
      Boolean(
        (entry.route as { methods?: Record<string, boolean> } | undefined)?.methods?.[method],
      ),
  );
  if (!layer || !("route" in layer) || !layer.route) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }
  return layer.route.stack[1].handle as Handler;
};

describe("ingress routes", () => {
  it("rejects requests without api key when configured", () => {
    const handler = findHandler("/slack/events", "post", { port: 0, ingressApiKey: "secret" });
    const response = createMockResponse();

    handler(
      {
        body: {},
        header: () => undefined,
      } as unknown as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("returns 400 for unsupported payload shape", () => {
    const handler = findHandler("/slack/events", "post");
    const response = createMockResponse();

    handler(
      {
        body: { event_id: "Ev01", team_id: "T1", event: { type: "reaction_added" } },
        header: () => undefined,
      } as unknown as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "unsupported_or_invalid_event" });
  });
});
