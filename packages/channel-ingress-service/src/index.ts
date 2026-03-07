import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createInMemoryIngressStore } from "./store.js";

const config = loadConfig();
const store = createInMemoryIngressStore();
const app = createServer(config, store);

app.listen(config.port, () => {
  console.log(`Channel ingress service listening on :${config.port}`);
});
