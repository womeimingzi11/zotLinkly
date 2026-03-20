import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export class SQLiteStateStore {
  constructor({ dbPath }) {
    this.dbPath = dbPath;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS item_mappings (
        item_key TEXT NOT NULL,
        source_key TEXT NOT NULL,
        source_type TEXT NOT NULL,
        workspace_path TEXT NOT NULL PRIMARY KEY,
        target_path TEXT,
        title TEXT,
        content_hash TEXT,
        doc_id TEXT,
        sync_state TEXT NOT NULL DEFAULT 'ready',
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_item_mappings_item_key
      ON item_mappings (item_key);

      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  replaceItemMappings(itemKey, mappings) {
    const deleteStatement = this.db.prepare(
      "DELETE FROM item_mappings WHERE item_key = ?",
    );
    const insertStatement = this.db.prepare(`
      INSERT INTO item_mappings (
        item_key, source_key, source_type, workspace_path, target_path, title,
        content_hash, doc_id, sync_state, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const runTransaction = (records) => {
      this.db.exec("BEGIN");
      try {
      deleteStatement.run(itemKey);
      for (const record of records) {
        insertStatement.run(
          record.itemKey,
          record.sourceKey,
          record.sourceType,
          record.workspacePath,
          record.targetPath ?? null,
          record.title ?? null,
          record.contentHash ?? null,
          record.docId ?? null,
          record.syncState ?? "ready",
          record.updatedAt ?? new Date().toISOString(),
        );
      }
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    };

    runTransaction(mappings);
  }

  getItemMappings(itemKey) {
    return this.db
      .prepare(
        `
          SELECT item_key AS itemKey,
                 source_key AS sourceKey,
                 source_type AS sourceType,
                 workspace_path AS workspacePath,
                 target_path AS targetPath,
                 title,
                 content_hash AS contentHash,
                 doc_id AS docId,
                 sync_state AS syncState,
                 updated_at AS updatedAt
          FROM item_mappings
          WHERE item_key = ?
          ORDER BY source_type, source_key
        `,
      )
      .all(itemKey);
  }

  getAllMappings() {
    return this.db
      .prepare(
        `
          SELECT item_key AS itemKey,
                 source_key AS sourceKey,
                 source_type AS sourceType,
                 workspace_path AS workspacePath,
                 target_path AS targetPath,
                 title,
                 content_hash AS contentHash,
                 doc_id AS docId,
                 sync_state AS syncState,
                 updated_at AS updatedAt
          FROM item_mappings
        `,
      )
      .all();
  }

  deleteItemMappings(itemKey) {
    this.db.prepare("DELETE FROM item_mappings WHERE item_key = ?").run(itemKey);
  }

  findMappingByPath(workspacePath) {
    return (
      this.db
        .prepare(
          `
            SELECT item_key AS itemKey,
                   source_key AS sourceKey,
                   source_type AS sourceType,
                   workspace_path AS workspacePath,
                   target_path AS targetPath,
                   title,
                   content_hash AS contentHash,
                   doc_id AS docId,
                   sync_state AS syncState,
                   updated_at AS updatedAt
            FROM item_mappings
            WHERE workspace_path = ?
          `,
        )
        .get(workspacePath) || null
    );
  }

  findMappingByPathSuffix(pathSuffix) {
    if (!pathSuffix) {
      return null;
    }

    const matches = this.db
      .prepare(
        `
          SELECT item_key AS itemKey,
                 source_key AS sourceKey,
                 source_type AS sourceType,
                 workspace_path AS workspacePath,
                 target_path AS targetPath,
                 title,
                 content_hash AS contentHash,
                 doc_id AS docId,
                 sync_state AS syncState,
                 updated_at AS updatedAt
          FROM item_mappings
          WHERE workspace_path LIKE ?
        `,
      )
      .all(`%${pathSuffix}`);

    return matches.length === 1 ? matches[0] : null;
  }

  findEvidenceById(evidenceId) {
    const parts = String(evidenceId).split(":");
    if (parts.length < 4) {
      return null;
    }

    const [itemKey, sourceType, sourceKey, docId] = parts;
    return (
      this.db
        .prepare(
          `
            SELECT item_key AS itemKey,
                   source_key AS sourceKey,
                   source_type AS sourceType,
                   workspace_path AS workspacePath,
                   target_path AS targetPath,
                   title,
                   content_hash AS contentHash,
                   doc_id AS docId,
                   sync_state AS syncState,
                   updated_at AS updatedAt
            FROM item_mappings
            WHERE item_key = ? AND source_type = ? AND source_key = ? AND doc_id = ?
          `,
        )
        .get(itemKey, sourceType, sourceKey, docId) || null
    );
  }

  recordDocId(workspacePath, docId) {
    this.db
      .prepare(
        `
          UPDATE item_mappings
          SET doc_id = ?, updated_at = ?
          WHERE workspace_path = ?
        `,
      )
      .run(docId, new Date().toISOString(), workspacePath);
  }

  getSyncCursor() {
    return (
      this.db.prepare("SELECT value FROM sync_state WHERE key = 'zoteroCursor'").get()
        ?.value || null
    );
  }

  setSyncCursor(cursor) {
    this.db
      .prepare(
        `
          INSERT INTO sync_state (key, value)
          VALUES ('zoteroCursor', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `,
      )
      .run(String(cursor));
  }
}
