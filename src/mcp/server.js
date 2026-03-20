import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { buildToolHandlers } from "./tool-handlers.js";

export async function startMcpServer({ libraryService, evidenceService }) {
  const handlers = buildToolHandlers({ libraryService, evidenceService });
  const server = new McpServer({
    name: "zotlinkly-mcp",
    version: "0.1.0",
  });

  server.tool(
    "search_items",
    "Search Zotero bibliographic items without applying RAG-style content filtering.",
    {
      query: z.string(),
      tags: z.array(z.string()).optional(),
      collections: z.array(z.string()).optional(),
      years: z.array(z.union([z.string(), z.number()])).optional(),
      limit: z.number().int().positive().max(100).optional(),
    },
    async (args) => jsonResult(await handlers.search_items(args)),
  );

  server.tool(
    "search_evidence",
    "Search Linkly-indexed Zotero assets and always map evidence back to Zotero item keys.",
    {
      query: z.string(),
      itemKeys: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      collections: z.array(z.string()).optional(),
      years: z.array(z.union([z.string(), z.number()])).optional(),
      limit: z.number().int().positive().max(200).optional(),
      mode: z.enum(["recall", "fast"]).optional(),
      resultShape: z.enum(["grouped", "flat"]).optional(),
      retrieveLimit: z.number().int().positive().max(1000).optional(),
      perItemEvidenceLimit: z.number().int().positive().max(10).optional(),
      useModelCompression: z.boolean().optional(),
    },
    async (args) => jsonResult(await handlers.search_evidence(args)),
  );

  server.tool(
    "read_context",
    "Read a larger context block for one evidence hit.",
    {
      evidenceId: z.string(),
    },
    async (args) => jsonResult(await handlers.read_context(args)),
  );

  server.tool(
    "get_item_bundle",
    "Fetch raw Zotero item metadata, attachments, notes, and annotations for a single item.",
    {
      itemKey: z.string(),
    },
    async (args) => jsonResult(await handlers.get_item_bundle(args)),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

function jsonResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}
