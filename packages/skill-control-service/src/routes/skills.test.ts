import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { createInMemorySkillControlStore } from "../store.js";
import { createSkillsRouter } from "./skills.js";

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
  const router = createSkillsRouter({
    signatureKey: "test-key",
    store: createInMemorySkillControlStore(),
  });
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

describe("skills routes validation", () => {
  it("rejects invalid artifact payload", () => {
    const handler = findHandler("/artifacts", "post");
    const response = createMockResponse();
    handler(
      {
        body: { tenantId: "tenant-a" },
      } as unknown as Request,
      response as unknown as Response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "invalid_artifact_payload" });
  });

  it("rejects invalid rollout payload", () => {
    const handler = findHandler("/rollouts", "post");
    const response = createMockResponse();
    handler(
      {
        body: {
          tenantId: "tenant-a",
          skillId: "skill-x",
          version: "1.0.0",
          stage: "invalid",
        },
      } as unknown as Request,
      response as unknown as Response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "invalid_rollout_payload" });
  });
});
