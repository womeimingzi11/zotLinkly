import fs from "node:fs/promises";
import path from "node:path";

import { hashContent } from "../utils/hash.js";
import { renderItemMarkdown } from "./markdown-export.js";
import {
  extensionForPath,
  normalizeWorkspacePath,
  slugify,
} from "../utils/text.js";

export class WorkspaceSyncService {
  constructor({ workspaceDir, stateStore }) {
    this.workspaceDir = workspaceDir;
    this.stateStore = stateStore;
  }

  async syncSnapshot(snapshot) {
    await this.ensureWorkspace();
    const now = new Date().toISOString();
    const itemMap = new Map(snapshot.items.map((item) => [item.key, item]));
    const attachmentsByItem = groupBy(snapshot.attachments, "parentItem");
    const notesByItem = groupBy(snapshot.notes, "parentItem");
    const annotationsByItem = groupBy(snapshot.annotations, "parentItem");
    const desiredMappings = new Map();

    for (const item of snapshot.items) {
      const mappings = [];
      const itemAttachments = attachmentsByItem.get(item.key) || [];
      const itemNotes = notesByItem.get(item.key) || [];
      const itemAnnotations = annotationsByItem.get(item.key) || [];

      for (const attachment of itemAttachments) {
        if (!attachment.path) {
          continue;
        }

        const attachmentDir = path.join(this.workspaceDir, "attachments", item.key);
        await fs.mkdir(attachmentDir, { recursive: true });

        const targetFile = path.join(
          attachmentDir,
          `${attachment.key}-${slugify(attachment.title)}${extensionForPath(
            attachment.path,
            attachment.contentType,
          )}`,
        );
        await replaceSymlink(attachment.path, targetFile);

        mappings.push({
          itemKey: item.key,
          sourceKey: attachment.key,
          sourceType: "attachment",
          workspacePath: normalizeWorkspacePath(targetFile),
          targetPath: normalizeWorkspacePath(attachment.path),
          title: attachment.title,
          contentHash: hashContent(`${attachment.path}:${attachment.title}`),
          updatedAt: now,
        });
      }

      const notePath = path.join(this.workspaceDir, "notes", `${item.key}.md`);
      const noteText = renderItemMarkdown({
        item,
        attachments: itemAttachments,
        notes: itemNotes,
        annotations: itemAnnotations,
      });

      await fs.mkdir(path.dirname(notePath), { recursive: true });
      await fs.writeFile(notePath, noteText, "utf8");

      mappings.push({
        itemKey: item.key,
        sourceKey: item.key,
        sourceType: "note",
        workspacePath: normalizeWorkspacePath(notePath),
        targetPath: null,
        title: item.title,
        contentHash: hashContent(noteText),
        updatedAt: now,
      });

      this.stateStore.replaceItemMappings(item.key, mappings);
      desiredMappings.set(item.key, mappings);
    }

    const existingMappings = this.stateStore.getAllMappings();
    const desiredPaths = new Set(
      [...desiredMappings.values()].flat().map((mapping) => mapping.workspacePath),
    );

    let removedEntries = 0;
    for (const mapping of existingMappings) {
      if (desiredPaths.has(mapping.workspacePath) || itemMap.has(mapping.itemKey)) {
        continue;
      }
      await removeIfExists(mapping.workspacePath);
      removedEntries += 1;
      this.stateStore.deleteItemMappings(mapping.itemKey);
    }

    return {
      syncedItems: snapshot.items.length,
      removedEntries,
    };
  }

  async ensureWorkspace() {
    await fs.mkdir(path.join(this.workspaceDir, "attachments"), { recursive: true });
    await fs.mkdir(path.join(this.workspaceDir, "notes"), { recursive: true });
  }
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const groupKey = item[key];
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey).push(item);
  }
  return grouped;
}

async function replaceSymlink(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.rm(targetPath, { force: true });
  await fs.symlink(sourcePath, targetPath);
}

async function removeIfExists(targetPath) {
  await fs.rm(targetPath, { force: true });
}
