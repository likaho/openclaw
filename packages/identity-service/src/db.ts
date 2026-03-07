import { Pool } from "pg";

export const createPool = (databaseUrl: string): Pool => new Pool({ connectionString: databaseUrl });

export const ensureSchema = async (pool: Pool): Promise<void> => {
  await pool.query(`
    create table if not exists identity_sessions (
      id text primary key,
      tenant_id text not null,
      workspace_id text not null,
      subject text not null,
      roles jsonb not null,
      entitlements jsonb,
      idp_issuer text not null,
      idp_subject text not null,
      created_at timestamptz not null,
      expires_at timestamptz not null
    );
  `);

  await pool.query(`
    create table if not exists identity_refresh_tokens (
      token_hash text primary key,
      session_id text not null references identity_sessions(id) on delete cascade,
      expires_at timestamptz not null
    );
  `);
};
