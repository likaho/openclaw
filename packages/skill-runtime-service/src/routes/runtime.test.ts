import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { createInMemoryRuntimeStore } from "../store.js";
import { createRuntimeRouter } from "./runtime.js";

type Handler = (req: Request, res: Response) => void | Promise<void>;
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
  const router = createRuntimeRouter(
    {
      port: 0,
      maxTimeoutMs: 30000,
      maxMemoryMb: 512,
      allowedCapabilities: ["http-readonly"],
    },
    createInMemoryRuntimeStore(),
  );
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

describe("runtime routes validation", () => {
  it("rejects jobs with unsupported runtime", async () => {
    const handler = findHandler("/jobs", "post");
    const response = createMockResponse();
    await handler(
      {
        body: {
          tenantId: "tenant-a",
          skillId: "skill-weather",
          runtime: "ruby",
          capabilityProfile: "http-readonly",
          timeoutMs: 1000,
          memoryMb: 64,
          payload: "hello",
        },
      } as unknown as Request,
      response as unknown as Response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "runtime_not_supported" });
  });

  it("rejects jobs that exceed timeout limit", async () => {
    const handler = findHandler("/jobs", "post");
    const response = createMockResponse();
    await handler(
      {
        body: {
          tenantId: "tenant-a",
          skillId: "skill-weather",
          runtime: "node",
          capabilityProfile: "http-readonly",
          timeoutMs: 90000,
          memoryMb: 64,
          payload: "hello",
        },
      } as unknown as Request,
      response as unknown as Response,
    );
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "timeout_exceeds_limit" });
  });
});
