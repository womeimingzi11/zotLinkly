import os from "node:os";
import path from "node:path";

export function getConfig() {
  const baseDir = process.env.ZOTLINKLY_HOME || path.join(os.homedir(), ".zotlinkly");
  return {
    homeDir: baseDir,
    workspaceDir: path.join(baseDir, "workspace"),
    dbPath: path.join(baseDir, "state.db"),
    zoteroEndpoint: process.env.ZOTLINKLY_ZOTERO_ENDPOINT || "http://127.0.0.1:23119",
    linklyEndpoint: process.env.ZOTLINKLY_LINKLY_ENDPOINT || "http://127.0.0.1:60606/mcp",
    syncIntervalMs: Number(process.env.ZOTLINKLY_SYNC_INTERVAL_MS || "30000"),
    linklyToken: process.env.ZOTLINKLY_LINKLY_TOKEN || null,
  };
}
