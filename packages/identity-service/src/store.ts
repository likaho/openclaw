import crypto from "node:crypto";
import type { Pool } from "pg";

export type SessionRecord = {
  id: string;
  tenantId: string;
  workspaceId: string;
  subject: string;
  roles: string[];
  entitlements?: string[];
  idpIssuer: string;
  idpSubject: string;
  createdAt: Date;
  expiresAt: Date;
};

export type RefreshTokenRecord = {
  tokenHash: string;
  sessionId: string;
  expiresAt: Date;
};

export type StateRecord = {
  state: string;
  redirectUri: string;
  tenantHint?: string;
  expiresAt: Date;
};

export type SessionStore = {
  createSession: (session: Omit<SessionRecord, "id">) => Promise<SessionRecord>;
  getSession: (sessionId: string) => Promise<SessionRecord | undefined>;
  storeRefreshToken: (record: RefreshTokenRecord) => Promise<void>;
  consumeRefreshToken: (tokenHash: string) => Promise<RefreshTokenRecord | undefined>;
};

export type StateStore = {
  createState: (record: Omit<StateRecord, "state" | "expiresAt">) => StateRecord;
  consumeState: (state: string) => StateRecord | undefined;
};

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const createInMemorySessionStore = (): SessionStore => {
  const sessions = new Map<string, SessionRecord>();
  const refreshTokens = new Map<string, RefreshTokenRecord>();

  return {
    createSession: async (session) => {
      const id = crypto.randomUUID();
      const record = { id, ...session };
      sessions.set(id, record);
      return record;
    },
    getSession: async (sessionId) => sessions.get(sessionId),
    storeRefreshToken: async (record) => {
      refreshTokens.set(record.tokenHash, record);
    },
    consumeRefreshToken: async (tokenHash) => {
      const record = refreshTokens.get(tokenHash);
      if (record) {
        refreshTokens.delete(tokenHash);
      }
      return record;
    },
  };
};

const mapSessionRow = (row: {
  id: string;
  tenant_id: string;
  workspace_id: string;
  subject: string;
  roles: string[];
  entitlements: string[] | null;
  idp_issuer: string;
  idp_subject: string;
  created_at: Date;
  expires_at: Date;
}): SessionRecord => ({
  id: row.id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  subject: row.subject,
  roles: row.roles,
  entitlements: row.entitlements ?? undefined,
  idpIssuer: row.idp_issuer,
  idpSubject: row.idp_subject,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

export const createPostgresSessionStore = (pool: Pool): SessionStore => ({
  createSession: async (session) => {
    const id = crypto.randomUUID();
    const result = await pool.query(
      `
        insert into identity_sessions (
          id,
          tenant_id,
          workspace_id,
          subject,
          roles,
          entitlements,
          idp_issuer,
          idp_subject,
          created_at,
          expires_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        returning *;
      `,
      [
        id,
        session.tenantId,
        session.workspaceId,
        session.subject,
        JSON.stringify(session.roles),
        session.entitlements ? JSON.stringify(session.entitlements) : null,
        session.idpIssuer,
        session.idpSubject,
        session.createdAt,
        session.expiresAt,
      ],
    );
    return mapSessionRow(result.rows[0]);
  },
  getSession: async (sessionId) => {
    const result = await pool.query(
      `select * from identity_sessions where id = $1`,
      [sessionId],
    );
    if (!result.rows[0]) {
      return undefined;
    }
    return mapSessionRow(result.rows[0]);
  },
  storeRefreshToken: async (record) => {
    await pool.query(
      `
        insert into identity_refresh_tokens (token_hash, session_id, expires_at)
        values ($1,$2,$3)
        on conflict (token_hash) do update set
          session_id = excluded.session_id,
          expires_at = excluded.expires_at;
      `,
      [record.tokenHash, record.sessionId, record.expiresAt],
    );
  },
  consumeRefreshToken: async (tokenHash) => {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query(
        `select * from identity_refresh_tokens where token_hash = $1`,
        [tokenHash],
      );
      const record = result.rows[0] as RefreshTokenRecord | undefined;
      if (record) {
        await client.query(`delete from identity_refresh_tokens where token_hash = $1`, [tokenHash]);
      }
      await client.query("commit");
      return record;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  },
});

export const createInMemoryStateStore = (ttlMs = 10 * 60 * 1000): StateStore => {
  const states = new Map<string, StateRecord>();

  return {
    createState: (record) => {
      const state = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + ttlMs);
      const stateRecord = { state, expiresAt, ...record };
      states.set(state, stateRecord);
      return stateRecord;
    },
    consumeState: (state) => {
      const record = states.get(state);
      if (!record) {
        return undefined;
      }
      states.delete(state);
      if (record.expiresAt.getTime() < Date.now()) {
        return undefined;
      }
      return record;
    },
  };
};
