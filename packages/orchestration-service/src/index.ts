import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createInMemoryWorkflowStore } from "./store.js";

const config = loadConfig();
const store = createInMemoryWorkflowStore();
const app = createServer(store);

app.listen(config.port, () => {
  console.log(`Orchestration service listening on :${config.port}`);
});
