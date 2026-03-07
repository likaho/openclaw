import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { createInMemoryTenantStore } from "../store.js";
import { createTenantRouter } from "./tenants.js";

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

const createMockRequest = (value: { body?: unknown; params?: Record<string, string> }): Request =>
  ({
    body: value.body ?? {},
    params: value.params ?? {},
  }) as Request;

const routeHandler = (path: string, method: "post" | "get" | "put"): Handler => {
  const store = createInMemoryTenantStore();
  const router = createTenantRouter(store);
  const layer = router.stack.find(
    (entry) =>
      "route" in entry &&
      entry.route?.path === path &&
      Boolean(
        (entry.route as { methods?: Record<string, boolean> } | undefined)?.methods?.[method],
      ),
  );
  if (!layer || !("route" in layer) || !layer.route) {
    throw new Error(`Route not found for ${method.toUpperCase()} ${path}`);
  }
  return layer.route.stack[1].handle as Handler;
};

describe("tenant routes validation", () => {
  it("rejects invalid quota configuration", () => {
    const handler = routeHandler("/tenants", "post");
    const response = createMockResponse();

    handler(
      createMockRequest({
        body: {
          id: "tenant-a",
          name: "Tenant A",
          quotas: { maxWorkspaces: 0, maxMonthlyMessages: 1000 },
          featureFlags: [],
          policies: [],
        },
      }),
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "invalid_max_workspaces" });
  });

  it("rejects duplicate policies", () => {
    const handler = routeHandler("/tenants", "post");
    const response = createMockResponse();

    handler(
      createMockRequest({
        body: {
          id: "tenant-a",
          name: "Tenant A",
          quotas: { maxWorkspaces: 1, maxMonthlyMessages: 1000 },
          featureFlags: [],
          policies: ["allow-chat", "allow-chat"],
        },
      }),
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "duplicate_policies" });
  });
});
