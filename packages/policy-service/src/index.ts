import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createInMemoryPolicyStore } from "./store.js";

const config = loadConfig();
const store = createInMemoryPolicyStore();
const app = createServer(store);

app.listen(config.port, () => {
  console.log(`Policy service listening on :${config.port}`);
});
