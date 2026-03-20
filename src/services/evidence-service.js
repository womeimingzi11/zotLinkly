import { buildCitation, normalizeWorkspacePath } from "../utils/text.js";

export class EvidenceService {
  constructor({ stateStore, zoteroClient, linklyClient }) {
    this.stateStore = stateStore;
    this.zoteroClient = zoteroClient;
    this.linklyClient = linklyClient;
  }

  async searchEvidence({ query, itemKeys, tags = [], collections = [], years = [], limit = 10 } = {}) {
    const items = await this.zoteroClient.listItems({
      query: "",
      itemKeys,
      tags,
      collections,
      years,
      limit: Math.max(limit * 20, 500),
    });

    const eligibleItems = items.filter(
      (item) => !itemKeys || itemKeys.length === 0 || itemKeys.includes(item.key),
    );

    const allowedItemKeys = new Set(eligibleItems.map((item) => item.key));
    const itemByKey = new Map(eligibleItems.map((item) => [item.key, item]));

    const linklyResults = await this.linklyClient.searchDocuments({
      query,
      limit: Math.max(limit * 2, 20),
    });

    const evidence = [];
    for (const result of linklyResults) {
      const workspacePath = normalizeWorkspacePath(result.path || result.filePath);
      const mapping =
        this.stateStore.findMappingByPath(workspacePath) ||
        this.stateStore.findMappingByPathSuffix?.(toWorkspaceSuffix(workspacePath));
      if (!mapping || !allowedItemKeys.has(mapping.itemKey)) {
        continue;
      }
      const item = itemByKey.get(mapping.itemKey);
      if (!item) {
        continue;
      }
      if (result.doc_id && typeof this.stateStore.recordDocId === "function") {
        this.stateStore.recordDocId(mapping.workspacePath, result.doc_id);
      }
      evidence.push({
        evidenceId: `${mapping.itemKey}:${mapping.sourceType}:${mapping.sourceKey}:${result.doc_id}`,
        itemKey: mapping.itemKey,
        sourceType: mapping.sourceType,
        sourceKey: mapping.sourceKey,
        title: result.title || mapping.title || item.title,
        snippet: result.snippet || result.summary || "",
        path: workspacePath,
        docId: result.doc_id || null,
        citation: buildCitation(item),
      });
      if (evidence.length >= limit) {
        break;
      }
    }

    return evidence;
  }

  async readContext({ evidenceId }) {
    const mapping = this.stateStore.findEvidenceById(evidenceId);
    if (!mapping) {
      throw new Error("Unknown evidenceId");
    }

    const [item, outline, context] = await Promise.all([
      this.zoteroClient.getItem(mapping.itemKey),
      this.linklyClient.outlineDocument(mapping.docId),
      this.linklyClient.readDocument(mapping.docId),
    ]);

    return {
      item,
      outline,
      context,
    };
  }
}

function toWorkspaceSuffix(filePath) {
  const normalized = normalizeWorkspacePath(filePath);
  if (!normalized) {
    return normalized;
  }
  return normalized.replace(/^\.\.\./, "");
}
