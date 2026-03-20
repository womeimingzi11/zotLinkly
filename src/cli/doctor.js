import { getConfig } from "../config.js";
import { createApplication } from "../bootstrap.js";

const app = createApplication(getConfig());

const [zoteroOk, linklyOk] = await Promise.allSettled([
  app.zoteroClient.ping(),
  app.linklyClient.ping(),
]);

console.log(
  JSON.stringify(
    {
      zotero: zoteroOk.status === "fulfilled" ? "ok" : zoteroOk.reason?.message,
      linkly: linklyOk.status === "fulfilled" ? "ok" : linklyOk.reason?.message,
      workspaceDir: app.config.workspaceDir,
      dbPath: app.config.dbPath,
    },
    null,
    2,
  ),
);
