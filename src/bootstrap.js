import { SQLiteStateStore } from "./state/sqlite-state-store.js";
import { WorkspaceSyncService } from "./sync/workspace-sync-service.js";
import { LibraryService } from "./services/library-service.js";
import { EvidenceService } from "./services/evidence-service.js";
import { ZoteroBridgeClient } from "./clients/zotero-client.js";
import { LinklyClient } from "./clients/linkly-client.js";
import { SyncDaemon } from "./daemon/sync-daemon.js";

export function createApplication(config) {
  const stateStore = new SQLiteStateStore({ dbPath: config.dbPath });
  const zoteroClient = new ZoteroBridgeClient({ endpoint: config.zoteroEndpoint });
  const linklyClient = new LinklyClient({
    endpoint: config.linklyEndpoint,
    token: config.linklyToken,
  });
  const workspaceSyncService = new WorkspaceSyncService({
    workspaceDir: config.workspaceDir,
    stateStore,
  });
  const libraryService = new LibraryService({ zoteroClient });
  const evidenceService = new EvidenceService({
    stateStore,
    zoteroClient,
    linklyClient,
  });
  const syncDaemon = new SyncDaemon({
    zoteroClient,
    workspaceSyncService,
    stateStore,
    intervalMs: config.syncIntervalMs,
  });

  return {
    config,
    stateStore,
    zoteroClient,
    linklyClient,
    workspaceSyncService,
    libraryService,
    evidenceService,
    syncDaemon,
  };
}
