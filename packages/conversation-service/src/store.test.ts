import { describe, expect, test } from "vitest";
import { createInMemoryConversationStore, verifyAuditSequence } from "./store.js";

describe("conversation store", () => {
  test("isolates memory entries by tenant and conversation", () => {
    const store = createInMemoryConversationStore();
    store.saveMemoryEntry({
      tenantId: "tenant-a",
      conversationId: "conv-1",
      role: "user",
      content: "hello from tenant a",
      retentionDays: 30,
    });
    store.saveMemoryEntry({
      tenantId: "tenant-b",
      conversationId: "conv-1",
      role: "user",
      content: "hello from tenant b",
      retentionDays: 30,
    });

    const tenantAEntries = store.listMemoryEntries("tenant-a", "conv-1");
    const tenantBEntries = store.listMemoryEntries("tenant-b", "conv-1");

    expect(tenantAEntries).toHaveLength(1);
    expect(tenantAEntries[0]?.content).toContain("tenant a");
    expect(tenantBEntries).toHaveLength(1);
    expect(tenantBEntries[0]?.content).toContain("tenant b");
  });

  test("applies retention filtering and prunes expired entries", () => {
    const store = createInMemoryConversationStore();
    store.saveMemoryEntry({
      tenantId: "tenant-a",
      conversationId: "conv-2",
      role: "assistant",
      content: "expired",
      createdAt: "2025-01-01T00:00:00.000Z",
      retentionDays: 1,
    });

    const entries = store.listMemoryEntries("tenant-a", "conv-2", "2025-01-03T00:00:00.000Z");
    expect(entries).toHaveLength(0);
    expect(store.listMemoryEntries("tenant-a", "conv-2")).toHaveLength(0);
  });

  test("maintains immutable hash chain and detects integrity breaks", () => {
    const store = createInMemoryConversationStore();
    store.appendAuditEvent({
      tenantId: "tenant-a",
      eventType: "provider.proxy.invoked",
      actor: "system",
      payload: { provider: "openai" },
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.appendAuditEvent({
      tenantId: "tenant-a",
      eventType: "conversation.memory.saved",
      actor: "system",
      payload: { conversationId: "conv-1" },
      createdAt: "2026-01-01T00:00:01.000Z",
    });

    const ok = store.verifyAuditIntegrity("tenant-a");
    expect(ok.valid).toBe(true);
    expect(ok.checked).toBe(2);

    const events = store.listAuditEvents("tenant-a");
    const tampered = [...events];
    tampered[1] = { ...tampered[1], previousHash: "tampered" };
    const broken = verifyAuditSequence(tampered);
    expect(broken.valid).toBe(false);
    expect(broken.reason).toBe("previous_hash_mismatch");
  });
});
