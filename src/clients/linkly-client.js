import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { buildSearchQueries, normalizeWorkspacePath } from "../utils/text.js";

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
    const result = await this.#callTool("search", {
      query,
      limit: Math.max(1, Math.min(limit, 50)),
      output_format: "json",
    });
    return normalizeSearchResults(result);
  }

  async searchDocumentsExpanded({
    query,
    mode = "recall",
    retrieveLimit = mode === "fast" ? 100 : 500,
  }) {
    const perSearchLimit = 50;
    const queries = buildSearchQueries(query, { mode });
    const mergedResults = new Map();
    let staleRounds = 0;
    let roundsExecuted = 0;
    const queriesTried = [];

    for (const expandedQuery of queries) {
      const roundResults = await this.searchDocuments({
        query: expandedQuery,
        limit: perSearchLimit,
      });
      roundsExecuted += 1;
      queriesTried.push(expandedQuery);

      let newHits = 0;
      for (const result of roundResults) {
        const key = buildResultKey(result);
        const current = mergedResults.get(key);
        if (!current) {
          mergedResults.set(key, {
            ...result,
            matchedQueries: [expandedQuery],
          });
          newHits += 1;
          continue;
        }

        mergedResults.set(key, mergeSearchResult(current, result, expandedQuery));
      }

      staleRounds = newHits === 0 ? staleRounds + 1 : 0;
      if (mergedResults.size >= retrieveLimit) {
        break;
      }
      if (staleRounds >= (mode === "fast" ? 1 : 2)) {
        break;
      }
    }

    const sortedResults = Array.from(mergedResults.values())
      .sort(compareSearchResults)
      .slice(0, retrieveLimit);

    return {
      results: sortedResults,
      diagnostics: {
        roundsExecuted,
        queriesTried,
        truncated: mergedResults.size > retrieveLimit,
        totalUniqueResults: mergedResults.size,
      },
    };
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

function buildResultKey(result) {
  return result.doc_id || normalizeWorkspacePath(result.path || result.filePath || result.title || "");
}

function mergeSearchResult(current, next, query) {
  const currentRelevance = Number(current.relevance || 0);
  const nextRelevance = Number(next.relevance || 0);
  const preferred = nextRelevance > currentRelevance ? next : current;
  return {
    ...preferred,
    matchedQueries: Array.from(
      new Set([...(current.matchedQueries || []), ...(next.matchedQueries || []), query]),
    ),
    relevance: Math.max(currentRelevance, nextRelevance),
  };
}

function compareSearchResults(left, right) {
  const leftRelevance = Number(left.relevance || 0);
  const rightRelevance = Number(right.relevance || 0);
  if (rightRelevance !== leftRelevance) {
    return rightRelevance - leftRelevance;
  }
  return String(left.title || "").localeCompare(String(right.title || ""));
}
