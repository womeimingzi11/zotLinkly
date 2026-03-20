export class SyncDaemon {
  constructor({ zoteroClient, workspaceSyncService, stateStore, intervalMs = 30000, logger = console }) {
    this.zoteroClient = zoteroClient;
    this.workspaceSyncService = workspaceSyncService;
    this.stateStore = stateStore;
    this.intervalMs = intervalMs;
    this.logger = logger;
    this.timer = null;
    this.running = false;
  }

  async start() {
    if (this.running) {
      return;
    }
    this.running = true;
    await this.syncOnce();
    this.timer = setInterval(() => {
      this.syncOnce().catch((error) => {
        this.logger.error("Sync tick failed", error);
      });
    }, this.intervalMs);
  }

  async stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async syncOnce(force = false) {
    const nextCursor = await this.zoteroClient.getChangeCursor();
    const currentCursor = this.stateStore.getSyncCursor();
    if (!force && currentCursor && String(currentCursor) === String(nextCursor)) {
      return { skipped: true, cursor: currentCursor };
    }
    const snapshot = await this.zoteroClient.getLibrarySnapshot();
    const result = await this.workspaceSyncService.syncSnapshot(snapshot);
    this.stateStore.setSyncCursor(nextCursor);
    return { skipped: false, cursor: nextCursor, ...result };
  }
}
