import { describe, expect, it } from "vitest";
import { createInMemorySessionStore, createInMemoryStateStore, hashToken } from "./store.js";

describe("session store", () => {
  it("stores and consumes refresh tokens", () => {
    const store = createInMemorySessionStore();
    const session = store.createSession({
      tenantId: "tenant-a",
      workspaceId: "default",
      subject: "user-1",
      roles: ["member"],
      entitlements: ["basic"],
      idpIssuer: "issuer",
      idpSubject: "sub",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    });

    const tokenHash = hashToken("refresh-token");
    store.storeRefreshToken({
      tokenHash,
      sessionId: session.id,
      expiresAt: new Date(Date.now() + 1000),
    });

    const consumed = store.consumeRefreshToken(tokenHash);
    expect(consumed?.sessionId).toBe(session.id);
    expect(store.consumeRefreshToken(tokenHash)).toBeUndefined();
  });
});

describe("state store", () => {
  it("creates and consumes state", () => {
    const store = createInMemoryStateStore(60_000);
    const state = store.createState({ redirectUri: "http://localhost", tenantHint: "tenant" });
    const consumed = store.consumeState(state.state);
    expect(consumed?.tenantHint).toBe("tenant");
    expect(store.consumeState(state.state)).toBeUndefined();
  });
});
