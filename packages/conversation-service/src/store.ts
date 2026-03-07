import { createHash, randomUUID } from "node:crypto";
import type { AuditEvent, MemoryEntry } from "./types.js";

export type MemoryEntryInput = {
  tenantId: string;
  conversationId: string;
  role: MemoryEntry["role"];
  content: string;
  createdAt?: string;
  retentionDays: number;
};

export type AuditEventInput = {
  tenantId: string;
  eventType: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt?: string;
};

export type AuditVerification = {
  valid: boolean;
  checked: number;
  reason?: string;
};

export type ConversationStore = {
  saveMemoryEntry: (input: MemoryEntryInput) => MemoryEntry;
  listMemoryEntries: (tenantId: string, conversationId: string, nowIso?: string) => MemoryEntry[];
  appendAuditEvent: (input: AuditEventInput) => AuditEvent;
  listAuditEvents: (tenantId: string, limit?: number) => AuditEvent[];
  verifyAuditIntegrity: (tenantId: string) => AuditVerification;
};

const hashEvent = (event: Omit<AuditEvent, "hash">): string => {
  const digest = createHash("sha256");
  digest.update(
    JSON.stringify({
      sequence: event.sequence,
      tenantId: event.tenantId,
      eventType: event.eventType,
      actor: event.actor,
      payload: event.payload,
      createdAt: event.createdAt,
      previousHash: event.previousHash,
    }),
  );
  return digest.digest("hex");
};

export const verifyAuditSequence = (events: AuditEvent[]): AuditVerification => {
  let previousHash: string | null = null;
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const expectedSequence = i + 1;
    if (event.sequence !== expectedSequence) {
      return { valid: false, checked: i, reason: "sequence_gap" };
    }
    if (event.previousHash !== previousHash) {
      return { valid: false, checked: i, reason: "previous_hash_mismatch" };
    }
    const expectedHash = hashEvent({
      sequence: event.sequence,
      tenantId: event.tenantId,
      eventType: event.eventType,
      actor: event.actor,
      payload: event.payload,
      createdAt: event.createdAt,
      previousHash: event.previousHash,
    });
    if (event.hash !== expectedHash) {
      return { valid: false, checked: i, reason: "hash_mismatch" };
    }
    previousHash = event.hash;
  }

  return { valid: true, checked: events.length };
};

export const createInMemoryConversationStore = (): ConversationStore => {
  const memoryByTenantConversation = new Map<string, MemoryEntry[]>();
  const auditByTenant = new Map<string, AuditEvent[]>();

  return {
    saveMemoryEntry: (input) => {
      const createdAt = input.createdAt ?? new Date().toISOString();
      const expiresAt = new Date(
        Date.parse(createdAt) + input.retentionDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      const entry: MemoryEntry = {
        id: randomUUID(),
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        createdAt,
        expiresAt,
      };
      const key = `${input.tenantId}:${input.conversationId}`;
      const current = memoryByTenantConversation.get(key) ?? [];
      memoryByTenantConversation.set(key, [entry, ...current]);
      return { ...entry };
    },

    listMemoryEntries: (tenantId, conversationId, nowIso) => {
      const now = Date.parse(nowIso ?? new Date().toISOString());
      const key = `${tenantId}:${conversationId}`;
      const entries = memoryByTenantConversation.get(key) ?? [];
      const validEntries = entries.filter((entry) => Date.parse(entry.expiresAt) > now);
      if (validEntries.length !== entries.length) {
        memoryByTenantConversation.set(key, validEntries);
      }
      return validEntries.map((entry) => ({ ...entry }));
    },

    appendAuditEvent: (input) => {
      const current = auditByTenant.get(input.tenantId) ?? [];
      const previous = current.length > 0 ? current[current.length - 1] : undefined;
      const base = {
        sequence: current.length + 1,
        tenantId: input.tenantId,
        eventType: input.eventType,
        actor: input.actor,
        payload: { ...input.payload },
        createdAt: input.createdAt ?? new Date().toISOString(),
        previousHash: previous?.hash ?? null,
      };
      const event: AuditEvent = {
        ...base,
        hash: hashEvent(base),
      };
      auditByTenant.set(input.tenantId, [...current, event]);
      return { ...event, payload: { ...event.payload } };
    },

    listAuditEvents: (tenantId, limit = 100) => {
      const entries = auditByTenant.get(tenantId) ?? [];
      return entries.slice(-Math.max(1, Math.min(limit, 500))).map((entry) => ({
        ...entry,
        payload: { ...entry.payload },
      }));
    },

    verifyAuditIntegrity: (tenantId) => {
      const entries = auditByTenant.get(tenantId) ?? [];
      return verifyAuditSequence(entries);
    },
  };
};
