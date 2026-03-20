import test from "node:test";
import assert from "node:assert/strict";

import { LinklyClient } from "../src/clients/linkly-client.js";

test("searchDocuments requests JSON output and parses JSON text payloads", async () => {
  const calls = [];
  const client = new LinklyClient({
    endpoint: "http://127.0.0.1:60606/mcp",
  });

  client.client = {
    async callTool({ name, arguments: args }) {
      calls.push({ name, args });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              query: "soil nematode",
              results: [
                {
                  doc_id: "doc-1",
                  path: ".../workspace/notes/ITEM1.md",
                  title: "ITEM1",
                },
              ],
            }),
          },
        ],
      };
    },
  };

  const result = await client.searchDocuments({ query: "soil nematode", limit: 5 });

  assert.deepEqual(calls, [
    {
      name: "search",
      args: {
        query: "soil nematode",
        limit: 5,
        output_format: "json",
      },
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].doc_id, "doc-1");
});
