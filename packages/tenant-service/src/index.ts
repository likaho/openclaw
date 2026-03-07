import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createInMemoryTenantStore } from "./store.js";

const config = loadConfig();
const store = createInMemoryTenantStore();
const app = createServer(store);

app.listen(config.port, () => {
  console.log(`Tenant service listening on :${config.port}`);
});
