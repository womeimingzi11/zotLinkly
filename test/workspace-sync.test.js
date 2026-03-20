import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { SQLiteStateStore } from "../src/state/sqlite-state-store.js";
import { WorkspaceSyncService } from "../src/sync/workspace-sync-service.js";

test("sync writes attachment links, note markdown, and state mappings", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zotlinkly-sync-"));
  const workspaceDir = path.join(root, "workspace");
  const dataDir = path.join(root, "data");
  const attachmentSourceDir = path.join(root, "attachments-source");
  const dbPath = path.join(root, "state.db");

  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(attachmentSourceDir, { recursive: true });

  const attachmentFile = path.join(attachmentSourceDir, "paper.pdf");
  await fs.writeFile(attachmentFile, "fake-pdf");

  const store = new SQLiteStateStore({ dbPath });
  const syncService = new WorkspaceSyncService({
    workspaceDir,
    stateStore: store,
  });

  const result = await syncService.syncSnapshot({
    items: [
      {
        key: "ITEM1",
        title: "Foundations of Ecological Governance",
        abstractNote: "A theory paper.",
        date: "2024",
        creators: [{ firstName: "Ada", lastName: "Lovelace" }],
        publicationTitle: "Journal of Tests",
        tags: [{ tag: "theory" }],
        collections: [{ key: "COL1", name: "Review Set" }],
      },
    ],
    attachments: [
      {
        key: "ATT1",
        parentItem: "ITEM1",
        title: "Main PDF",
        path: attachmentFile,
        contentType: "application/pdf",
      },
    ],
    notes: [
      {
        key: "NOTE1",
        parentItem: "ITEM1",
        title: "Core note",
        note: "<p>Main argument</p>",
      },
    ],
    annotations: [
      {
        key: "ANN1",
        parentItem: "ITEM1",
        parentAttachment: "ATT1",
        annotationText: "Collective action matters",
        comment: "Useful mechanism framing",
        color: "#ffd400",
        pageLabel: "7",
      },
    ],
  });

  assert.equal(result.syncedItems, 1);
  assert.equal(result.removedEntries, 0);

  const attachmentLink = path.join(
    workspaceDir,
    "attachments",
    "ITEM1",
    "ATT1-Main-PDF.pdf",
  );
  const noteFile = path.join(workspaceDir, "notes", "ITEM1.md");

  const attachmentStat = await fs.lstat(attachmentLink);
  assert.equal(attachmentStat.isSymbolicLink(), true);
  assert.equal(await fs.readlink(attachmentLink), attachmentFile);

  const noteText = await fs.readFile(noteFile, "utf8");
  assert.match(noteText, /itemKey: ITEM1/);
  assert.match(noteText, /Foundations of Ecological Governance/);
  assert.match(noteText, /Main argument/);
  assert.match(noteText, /Collective action matters/);

  const mappings = store.getItemMappings("ITEM1");
  assert.equal(mappings.length, 2);
  assert.deepEqual(
    mappings.map((entry) => entry.sourceType).sort(),
    ["attachment", "note"],
  );
});

test("sync removes stale attachment links and note files when item disappears", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zotlinkly-cleanup-"));
  const workspaceDir = path.join(root, "workspace");
  const dbPath = path.join(root, "state.db");
  const attachmentSource = path.join(root, "paper.pdf");
  await fs.writeFile(attachmentSource, "fake");

  const store = new SQLiteStateStore({ dbPath });
  const syncService = new WorkspaceSyncService({
    workspaceDir,
    stateStore: store,
  });

  await syncService.syncSnapshot({
    items: [{ key: "ITEM1", title: "Paper", creators: [], tags: [], collections: [] }],
    attachments: [
      {
        key: "ATT1",
        parentItem: "ITEM1",
        title: "Paper",
        path: attachmentSource,
        contentType: "application/pdf",
      },
    ],
    notes: [],
    annotations: [],
  });

  const cleanupResult = await syncService.syncSnapshot({
    items: [],
    attachments: [],
    notes: [],
    annotations: [],
  });

  assert.equal(cleanupResult.removedEntries, 2);
  await assert.rejects(() =>
    fs.access(path.join(workspaceDir, "attachments", "ITEM1", "ATT1-Paper.pdf")),
  );
  await assert.rejects(() => fs.access(path.join(workspaceDir, "notes", "ITEM1.md")));
  assert.equal(store.getItemMappings("ITEM1").length, 0);
});
