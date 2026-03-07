import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { createInMemoryWorkflowStore } from "../store.js";
import { createWorkflowsRouter } from "./workflows.js";

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

const findHandler = (path: string, method: "post"): Handler => {
  const router = createWorkflowsRouter(createInMemoryWorkflowStore());
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

describe("workflows routes validation", () => {
  it("rejects missing dedupe key on create", () => {
    const handler = findHandler("/workflows", "post");
    const response = createMockResponse();
    handler(
      {
        body: {
          tenantId: "tenant-a",
          dedupeKey: "",
          correlationId: "corr-1",
        },
      } as unknown as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "invalid_dedupe_key" });
  });

  it("rejects unsupported transition event", () => {
    const handler = findHandler("/workflows/:workflowId/transition", "post");
    const response = createMockResponse();
    handler(
      {
        params: { workflowId: "wf-1" },
        body: { event: "pause" },
      } as unknown as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "invalid_transition_event" });
  });
});
