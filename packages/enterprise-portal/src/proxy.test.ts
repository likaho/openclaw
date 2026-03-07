import type { Request, Response } from "express";
import { describe, expect, test, vi } from "vitest";
import { proxyJsonRequest, resolveUpstreamUrl } from "./proxy.js";

describe("resolveUpstreamUrl", () => {
  test("maps onboarding/channels/skills/auth APIs to the correct upstream routes", () => {
    const config = {
      onboardingBaseUrl: "http://onboarding-service:4010/",
      identityBaseUrl: "http://identity-service:4001/",
    };

    expect(resolveUpstreamUrl(config, "onboarding", "/signup", "")).toBe(
      "http://onboarding-service:4010/v1/onboarding/signup",
    );
    expect(resolveUpstreamUrl(config, "channels", "/catalog", "")).toBe(
      "http://onboarding-service:4010/v1/channels/catalog",
    );
    expect(resolveUpstreamUrl(config, "skills", "/catalog", "?limit=10")).toBe(
      "http://onboarding-service:4010/v1/skills/catalog?limit=10",
    );
    expect(resolveUpstreamUrl(config, "auth", "/login", "")).toBe(
      "http://identity-service:4001/v1/auth/login",
    );
  });
});

describe("proxyJsonRequest", () => {
  test("forwards method/body and returns upstream status/body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      method: "POST",
      body: { email: "alice@example.com", displayName: "Alice" },
    } as unknown as Request;

    let statusCode = 0;
    let contentType = "";
    let payload = "";
    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      setHeader: (name: string, value: string) => {
        if (name.toLowerCase() === "content-type") {
          contentType = value;
        }
      },
      send: (body: string) => {
        payload = body;
      },
    } as unknown as Response;

    await proxyJsonRequest(req, res, "http://onboarding-service:4010/v1/onboarding/signup");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://onboarding-service:4010/v1/onboarding/signup", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "alice@example.com", displayName: "Alice" }),
    });
    expect(statusCode).toBe(201);
    expect(contentType).toContain("application/json");
    expect(payload).toContain('"ok":true');
  });
});
