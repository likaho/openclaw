import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createInMemoryConversationStore } from "./store.js";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const store = createInMemoryConversationStore();
  const app = createServer(config, store);

  app.listen(config.port, () => {
    console.log(`conversation-service listening on :${config.port}`);
  });
};

void main();
