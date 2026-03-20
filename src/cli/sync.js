import { getConfig } from "../config.js";
import { createApplication } from "../bootstrap.js";

const app = createApplication(getConfig());
const result = await app.syncDaemon.syncOnce(true);
console.log(JSON.stringify(result, null, 2));
