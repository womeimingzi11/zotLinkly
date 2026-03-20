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

test("searchDocumentsExpanded performs multi-query recall and deduplicates doc ids", async () => {
  const calls = [];
  const responses = new Map([
    [
      "soil nematode",
      {
        query: "soil nematode",
        results: [
          { doc_id: "doc-1", title: "A", path: ".../a.pdf", relevance: 0.8 },
          { doc_id: "doc-2", title: "B", path: ".../b.pdf", relevance: 0.7 },
        ],
      },
    ],
    [
      "\"soil nematode\"",
      {
        query: "\"soil nematode\"",
        results: [
          { doc_id: "doc-1", title: "A", path: ".../a.pdf", relevance: 0.9 },
          { doc_id: "doc-3", title: "C", path: ".../c.pdf", relevance: 0.6 },
        ],
      },
    ],
    [
      "nematode soil",
      {
        query: "nematode soil",
        results: [],
      },
    ],
  ]);
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
            text: JSON.stringify(responses.get(args.query) || { query: args.query, results: [] }),
          },
        ],
      };
    },
  };

  const result = await client.searchDocumentsExpanded({
    query: "soil nematode",
    mode: "recall",
    retrieveLimit: 10,
  });

  assert.equal(calls.length >= 2, true);
  assert.equal(calls[0].args.limit, 50);
  assert.equal(calls[0].args.output_format, "json");
  assert.equal(result.results.length, 3);
  assert.equal(result.results[0].doc_id, "doc-1");
  assert.deepEqual(result.results[0].matchedQueries.sort(), ["\"soil nematode\"", "soil nematode"]);
  assert.equal(result.diagnostics.roundsExecuted, calls.length);
  assert.deepEqual(result.diagnostics.queriesTried, calls.map((call) => call.args.query));
});
