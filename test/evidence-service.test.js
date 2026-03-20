import test from "node:test";
import assert from "node:assert/strict";

import { EvidenceService } from "../src/services/evidence-service.js";

test("searchEvidence defaults to recall/grouped and returns compressed paper groups", async () => {
  const evidenceService = new EvidenceService({
    stateStore: {
      findMappingByDocId(docId) {
        if (docId === "doc-1") {
          return {
            itemKey: "ITEM1",
            sourceKey: "ATT1",
            sourceType: "attachment",
            workspacePath: "/Users/test/.zotlinkly/workspace/attachments/ITEM1/ATT1.pdf",
          };
        }
        if (docId === "doc-2") {
          return {
            itemKey: "ITEM1",
            sourceKey: "NOTE1",
            sourceType: "note",
            workspacePath: "/Users/test/.zotlinkly/workspace/notes/ITEM1.md",
          };
        }
        return null;
      },
      findMappingByPath() {
        return null;
      },
      recordDocId() {},
    },
    zoteroClient: {
      async listItems() {
        return [
          {
            key: "ITEM1",
            title: "Foundations of Collective Action",
            abstractNote: "Collective action in shared institutions.",
            date: "2024",
            creators: [{ firstName: "Ada", lastName: "Lovelace" }],
            publicationTitle: "Journal of Tests",
            tags: [{ tag: "collective action" }],
            collections: [{ key: "COL1", name: "Review" }],
          },
        ];
      },
      async getItem(itemKey) {
        return {
          key: itemKey,
          title: "Foundations of Collective Action",
          abstractNote: "Collective action in shared institutions.",
          date: "2024",
          creators: [{ firstName: "Ada", lastName: "Lovelace" }],
          publicationTitle: "Journal of Tests",
          tags: [{ tag: "collective action" }],
          collections: [{ key: "COL1", name: "Review" }],
        };
      },
    },
    linklyClient: {
      async searchDocumentsExpanded(input) {
        assert.equal(input.mode, "recall");
        assert.equal(input.retrieveLimit, 500);
        return {
          results: [
            {
              doc_id: "doc-1",
              title: "ITEM1 PDF",
              path: ".../workspace/attachments/ITEM1/ATT1.pdf",
              snippet: "collective action mechanism in the main text",
              relevance: 0.9,
              matchedQueries: ["collective action"],
            },
            {
              doc_id: "doc-2",
              title: "ITEM1 note",
              path: ".../workspace/notes/ITEM1.md",
              snippet: "collective action note summary",
              relevance: 0.7,
              matchedQueries: ["collective action"],
            },
            {
              doc_id: "foreign-1",
              title: "Foreign file",
              path: "/tmp/other/file.md",
              snippet: "should be ignored",
              relevance: 0.95,
              matchedQueries: ["collective action"],
            },
          ],
          diagnostics: {
            roundsExecuted: 3,
            queriesTried: ["collective action", "\"collective action\"", "collective"],
            truncated: false,
            totalUniqueResults: 3,
          },
        };
      },
    },
  });

  const result = await evidenceService.searchEvidence({ query: "collective action" });

  assert.equal(result.mode, "recall");
  assert.equal(result.resultShape, "grouped");
  assert.equal(result.retrievedCount, 3);
  assert.equal(result.mappedCount, 2);
  assert.equal(result.groupedCount, 1);
  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].itemKey, "ITEM1");
  assert.equal(result.evidence[0].hitCount, 2);
  assert.deepEqual(result.evidence[0].sourceTypes, ["attachment", "note"]);
  assert.equal(result.evidence[0].evidence.length, 2);
  assert.equal(result.evidence[0].summary.includes("collective action"), true);
  assert.equal(result.diagnostics.roundsExecuted, 3);
  assert.equal(result.diagnostics.modelCompressionApplied, false);
});

test("searchEvidence flat shape is flattened from compressed grouped results", async () => {
  const evidenceService = new EvidenceService({
    stateStore: {
      findMappingByDocId(docId) {
        return {
          itemKey: "ITEM1",
          sourceKey: `SRC-${docId}`,
          sourceType: "attachment",
          workspacePath: `/Users/test/.zotlinkly/workspace/attachments/ITEM1/${docId}.pdf`,
        };
      },
      findMappingByPath() {
        return null;
      },
      recordDocId() {},
    },
    zoteroClient: {
      async listItems() {
        return [
          {
            key: "ITEM1",
            title: "Soil Nematode Communities",
            abstractNote: "A synthesis of soil nematode evidence.",
            date: "2024",
            creators: [{ firstName: "Ting", lastName: "Liu" }],
            publicationTitle: "Soil Biology",
            tags: [],
            collections: [],
          },
        ];
      },
      async getItem(itemKey) {
        return {
          key: itemKey,
          title: "Soil Nematode Communities",
          abstractNote: "A synthesis of soil nematode evidence.",
          date: "2024",
          creators: [{ firstName: "Ting", lastName: "Liu" }],
          publicationTitle: "Soil Biology",
          tags: [],
          collections: [],
        };
      },
    },
    linklyClient: {
      async searchDocumentsExpanded() {
        return {
          results: [
            {
              doc_id: "doc-1",
              title: "ITEM1 pdf",
              path: ".../workspace/attachments/ITEM1/doc-1.pdf",
              snippet: "soil nematode communities in drylands",
              relevance: 0.9,
              matchedQueries: ["soil nematode"],
            },
            {
              doc_id: "doc-2",
              title: "ITEM1 pdf",
              path: ".../workspace/attachments/ITEM1/doc-2.pdf",
              snippet: "soil nematode communities in drylands",
              relevance: 0.89,
              matchedQueries: ["soil nematode"],
            },
            {
              doc_id: "doc-3",
              title: "ITEM1 pdf",
              path: ".../workspace/attachments/ITEM1/doc-3.pdf",
              snippet: "soil nematode communities under warming",
              relevance: 0.8,
              matchedQueries: ["soil nematode"],
            },
          ],
          diagnostics: {
            roundsExecuted: 2,
            queriesTried: ["soil nematode", "\"soil nematode\""],
            truncated: false,
            totalUniqueResults: 3,
          },
        };
      },
    },
  });

  const result = await evidenceService.searchEvidence({
    query: "soil nematode",
    resultShape: "flat",
    perItemEvidenceLimit: 2,
    limit: 5,
  });

  assert.equal(result.resultShape, "flat");
  assert.equal(result.groupedCount, 1);
  assert.equal(result.evidence.length, 2);
  assert.equal(result.evidence[0].itemKey, "ITEM1");
  assert.equal(result.evidence[0].itemScore >= result.evidence[1].itemScore, true);
  assert.notEqual(result.evidence[0].snippet, result.evidence[1].snippet);
});

test("searchEvidence keeps item coverage even when relevant Zotero items appear after unrelated ones", async () => {
  const unrelatedItems = Array.from({ length: 20 }, (_, index) => ({
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
      findMappingByDocId(docId) {
        if (docId === "doc-11") {
          return {
            itemKey: "ITEM11",
            sourceKey: "ITEM11",
            sourceType: "note",
            workspacePath: "/Users/test/.zotlinkly/workspace/notes/ITEM11.md",
          };
        }
        return null;
      },
      findMappingByPath() {
        return null;
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
            abstractNote: "Review of soil nematode distributions.",
            date: "2024",
            creators: [{ firstName: "Ting", lastName: "Liu" }],
            publicationTitle: "Soil Biology and Biochemistry",
            tags: [],
            collections: [],
          },
        ];
      },
      async getItem(itemKey) {
        return {
          key: itemKey,
          title: "Spatial ecology of soil nematodes",
          abstractNote: "Review of soil nematode distributions.",
          date: "2024",
          creators: [{ firstName: "Ting", lastName: "Liu" }],
          publicationTitle: "Soil Biology and Biochemistry",
          tags: [],
          collections: [],
        };
      },
    },
    linklyClient: {
      async searchDocumentsExpanded(input) {
        assert.equal(input.mode, "fast");
        assert.equal(input.retrieveLimit, 100);
        return {
          results: [
            {
              doc_id: "doc-11",
              title: "ITEM11 note",
              path: ".../workspace/notes/ITEM11.md",
              snippet: "soil nematode evidence",
              relevance: 0.8,
              matchedQueries: ["soil nematode"],
            },
          ],
          diagnostics: {
            roundsExecuted: 1,
            queriesTried: ["soil nematode"],
            truncated: false,
            totalUniqueResults: 1,
          },
        };
      },
    },
  });

  const result = await evidenceService.searchEvidence({ query: "soil nematode", mode: "fast", limit: 1 });

  assert.equal(result.evidence.length, 1);
  assert.equal(result.evidence[0].itemKey, "ITEM11");
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
