import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { createInMemoryPolicyStore } from "../store.js";
import { createPolicyRouter } from "./policy.js";

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
  const router = createPolicyRouter(createInMemoryPolicyStore());
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

describe("policy routes validation", () => {
  it("rejects invalid subject in decide payload", () => {
    const handler = findHandler("/decide", "post");
    const response = createMockResponse();
    const request = {
      body: {
        tenantId: "tenant-a",
        subject: { tenantId: "tenant-a", roles: "admin" },
        resource: { tenantId: "tenant-a", type: "workspace" },
        action: "workspace:read",
      },
    } as Request;

    handler(request, response as unknown as Response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "invalid_subject" });
  });
});
