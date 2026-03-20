import test from "node:test";
import assert from "node:assert/strict";

import { buildToolHandlers } from "../src/mcp/tool-handlers.js";

test("tool handlers proxy to service layer with stable payload shapes", async () => {
  const handlers = buildToolHandlers({
    libraryService: {
      async searchItems(input) {
        assert.equal(input.query, "governance");
        return [{ itemKey: "ITEM1" }];
      },
      async getItemBundle(input) {
        assert.equal(input.itemKey, "ITEM1");
        return { item: { key: "ITEM1" } };
      },
    },
    evidenceService: {
      async searchEvidence(input) {
        assert.equal(input.query, "collective");
        return [{ evidenceId: "ITEM1:note:NOTE1:doc-1" }];
      },
      async readContext(input) {
        assert.equal(input.evidenceId, "ITEM1:note:NOTE1:doc-1");
        return { context: { text: "Paragraph" } };
      },
    },
  });

  assert.deepEqual(await handlers.search_items({ query: "governance" }), {
    items: [{ itemKey: "ITEM1" }],
  });
  assert.deepEqual(await handlers.get_item_bundle({ itemKey: "ITEM1" }), {
    bundle: { item: { key: "ITEM1" } },
  });
  assert.deepEqual(await handlers.search_evidence({ query: "collective" }), {
    evidence: [{ evidenceId: "ITEM1:note:NOTE1:doc-1" }],
  });
  assert.deepEqual(await handlers.read_context({ evidenceId: "ITEM1:note:NOTE1:doc-1" }), {
    result: { context: { text: "Paragraph" } },
  });
});
