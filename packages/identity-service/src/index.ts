import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

const config = loadConfig();
const app = createServer(config);

app.listen(config.port, () => {
  console.log(`Identity service listening on :${config.port}`);
});
