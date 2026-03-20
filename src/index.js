import { getConfig } from "./config.js";
import { createApplication } from "./bootstrap.js";
import { startMcpServer } from "./mcp/server.js";

const config = getConfig();
const app = createApplication(config);

await app.syncDaemon.start();
await startMcpServer({
  libraryService: app.libraryService,
  evidenceService: app.evidenceService,
});
