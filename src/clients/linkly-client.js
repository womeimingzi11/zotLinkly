import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export class LinklyClient {
  constructor({ endpoint, token }) {
    this.endpoint = endpoint;
    this.token = token;
    this.client = null;
  }

  async ping() {
    const client = await this.#getClient();
    const tools = await client.listTools();
    return Array.isArray(tools.tools);
  }

  async searchDocuments({ query, limit = 10 }) {
    const result = await this.#callTool("search", { query, limit, output_format: "json" });
    return normalizeSearchResults(result);
  }

  async outlineDocument(docId) {
    const result = await this.#callTool("outline", {
      doc_ids: [docId],
      output_format: "json",
    });
    return result?.outlines || result?.outline || result || [];
  }

  async readDocument(docId, offset = 1, limit = 200) {
    const result = await this.#callTool("read", {
      doc_id: docId,
      offset,
      limit,
      output_format: "json",
    });
    return result?.document || result;
  }

  async #callTool(name, args) {
    const client = await this.#getClient();
    const result = await client.callTool({ name, arguments: args });
    if (result.structuredContent) {
      return result.structuredContent;
    }
    const textChunk = result.content?.find((entry) => entry.type === "text")?.text;
    if (!textChunk) {
      return {};
    }
    try {
      return JSON.parse(textChunk);
    } catch {
      return { text: textChunk };
    }
  }

  async #getClient() {
    if (this.client) {
      return this.client;
    }
    const client = new Client(
      {
        name: "zotlinkly-linkly-client",
        version: "0.1.0",
      },
      { capabilities: {} },
    );
    const transport = new StreamableHTTPClientTransport(new URL(this.endpoint), {
      requestInit: this.token
        ? {
            headers: {
              Authorization: `Bearer ${this.token}`,
            },
          }
        : undefined,
    });
    await client.connect(transport);
    this.client = client;
    return client;
  }
}

function normalizeSearchResults(payload) {
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }
  if (Array.isArray(payload?.documents)) {
    return payload.documents;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  return [];
}
