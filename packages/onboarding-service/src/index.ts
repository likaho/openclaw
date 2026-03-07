import { loadConfig } from "./config.js";
import { createServer } from "./server.js";
import { createInMemoryOnboardingStore } from "./store.js";

const main = async (): Promise<void> => {
  const config = loadConfig();
  const store = createInMemoryOnboardingStore();

  // Seed one invite token so invite-only smoke can run without external admin API.
  store.createInvite("invitee@example.com", "tenant-invite");

  const app = createServer(config, store);

  app.listen(config.port, () => {
    console.log(`onboarding-service listening on :${config.port}`);
  });
};

void main();
