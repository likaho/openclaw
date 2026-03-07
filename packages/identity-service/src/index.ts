import { loadConfig } from "./config.js";
import { createPool, ensureSchema } from "./db.js";
import { createServer } from "./server.js";
import { createInMemorySessionStore, createPostgresSessionStore } from "./store.js";

const bootstrap = async (): Promise<void> => {
  const config = loadConfig();
  let sessionStore = createInMemorySessionStore();
  if (config.databaseUrl) {
    const pool = createPool(config.databaseUrl);
    await ensureSchema(pool);
    sessionStore = createPostgresSessionStore(pool);
  }

  const app = createServer(config, { sessionStore });

  app.listen(config.port, () => {
    console.log(`Identity service listening on :${config.port}`);
  });
};

bootstrap().catch((error: unknown) => {
  console.error("Failed to start Identity service", error);
  process.exit(1);
});
