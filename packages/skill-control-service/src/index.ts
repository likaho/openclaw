import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createInMemorySkillControlStore } from "./store.js";

const config = loadConfig();
const store = createInMemorySkillControlStore();
const app = createServer(config, store);

app.listen(config.port, () => {
  console.log(`Skill control service listening on :${config.port}`);
});
