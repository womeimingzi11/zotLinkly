import test from "node:test";
import assert from "node:assert/strict";

import { EvidenceService } from "../src/services/evidence-service.js";

test("searchEvidence keeps only mapped workspace results and enriches them with item data", async () => {
  const evidenceService = new EvidenceService({
    stateStore: {
      findMappingByPath(filePath) {
        if (filePath.endsWith("/workspace/notes/ITEM1.md")) {
          return {
            itemKey: "ITEM1",
            sourceKey: "NOTE1",
            sourceType: "note",
            workspacePath: filePath,
          };
        }
        return null;
      },
    },
    zoteroClient: {
      async listItems() {
        return [
          {
            key: "ITEM1",
            title: "Foundations",
            date: "2024",
            creators: [{ firstName: "Ada", lastName: "Lovelace" }],
            publicationTitle: "Journal of Tests",
            tags: [{ tag: "theory" }],
            collections: [{ key: "COL1", name: "Review" }],
          },
        ];
      },
    },
    linklyClient: {
      async searchDocuments() {
        return [
          {
            doc_id: "doc-1",
            title: "ITEM1 note",
            path: "/tmp/zotlinkly/workspace/notes/ITEM1.md",
            snippet: "collective action explanation",
          },
          {
            doc_id: "doc-2",
            title: "foreign file",
            path: "/tmp/other/file.md",
            snippet: "should be ignored",
          },
        ];
      },
    },
  });

  const result = await evidenceService.searchEvidence({ query: "collective action" });

  assert.equal(result.length, 1);
  assert.equal(result[0].itemKey, "ITEM1");
  assert.equal(result[0].sourceType, "note");
  assert.match(result[0].citation, /Lovelace/);
  assert.equal(result[0].snippet, "collective action explanation");
});

test("readContext prefers outline and returns read payload when mapping exists", async () => {
  const evidenceService = new EvidenceService({
    stateStore: {
      findEvidenceById(evidenceId) {
        assert.equal(evidenceId, "ITEM1:note:NOTE1:doc-1");
        return {
          itemKey: "ITEM1",
          sourceType: "note",
          sourceKey: "NOTE1",
          docId: "doc-1",
        };
      },
    },
    zoteroClient: {
      async getItem(key) {
        return { key, title: "Foundations", date: "2024", creators: [] };
      },
    },
    linklyClient: {
      async outlineDocument(docId) {
        assert.equal(docId, "doc-1");
        return [{ id: "1", title: "Argument" }];
      },
      async readDocument(docId) {
        assert.equal(docId, "doc-1");
        return { text: "Context paragraph", startLine: 1, endLine: 3 };
      },
    },
  });

  const result = await evidenceService.readContext({ evidenceId: "ITEM1:note:NOTE1:doc-1" });
  assert.equal(result.item.key, "ITEM1");
  assert.equal(result.context.text, "Context paragraph");
  assert.equal(result.outline.length, 1);
});

test("searchEvidence keeps query-matching items even when they appear after unrelated Zotero items", async () => {
  const unrelatedItems = Array.from({ length: 10 }, (_, index) => ({
    key: `ITEM${index}`,
    title: `Unrelated paper ${index}`,
    date: "2024",
    creators: [{ firstName: "Ada", lastName: "Lovelace" }],
    publicationTitle: "Journal of Tests",
    tags: [],
    collections: [],
  }));

  const evidenceService = new EvidenceService({
    stateStore: {
      findMappingByPath() {
        return null;
      },
      findMappingByPathSuffix(filePath) {
        assert.equal(filePath, "/workspace/notes/ITEM11.md");
        return {
          itemKey: "ITEM11",
          sourceKey: "ITEM11",
          sourceType: "note",
          workspacePath: "/Users/test/.zotlinkly/workspace/notes/ITEM11.md",
        };
      },
      recordDocId(workspacePath, docId) {
        assert.equal(workspacePath, "/Users/test/.zotlinkly/workspace/notes/ITEM11.md");
        assert.equal(docId, "doc-11");
      },
    },
    zoteroClient: {
      async listItems() {
        return [
          ...unrelatedItems,
          {
            key: "ITEM11",
            title: "Spatial ecology of soil nematodes",
            date: "2024",
            creators: [{ firstName: "Ting", lastName: "Liu" }],
            publicationTitle: "Soil Biology and Biochemistry",
            tags: [],
            collections: [],
          },
        ];
      },
    },
    linklyClient: {
      async searchDocuments() {
        return [
          {
            doc_id: "doc-11",
            title: "ITEM11 note",
            path: ".../workspace/notes/ITEM11.md",
            snippet: "soil nematode evidence",
          },
        ];
      },
    },
  });

  const result = await evidenceService.searchEvidence({ query: "soil nematode", limit: 1 });

  assert.equal(result.length, 1);
  assert.equal(result[0].itemKey, "ITEM11");
  assert.equal(result[0].docId, "doc-11");
});
