import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createInMemoryRuntimeStore } from "./store.js";

const config = loadConfig();
const store = createInMemoryRuntimeStore();
const app = createServer(config, store);

app.listen(config.port, () => {
  console.log(`Skill runtime service listening on :${config.port}`);
});
