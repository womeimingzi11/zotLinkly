import { buildCitation, normalizeWorkspacePath, tokenizeQuery } from "../utils/text.js";

const DEFAULT_RESULT_LIMIT = 40;
const DEFAULT_PER_ITEM_EVIDENCE_LIMIT = 2;
const DEFAULT_FAST_RETRIEVE_LIMIT = 100;
const DEFAULT_RECALL_RETRIEVE_LIMIT = 500;

export class EvidenceService {
  constructor({ stateStore, zoteroClient, linklyClient }) {
    this.stateStore = stateStore;
    this.zoteroClient = zoteroClient;
    this.linklyClient = linklyClient;
  }

  async searchEvidence({
    query,
    itemKeys,
    tags = [],
    collections = [],
    years = [],
    limit = DEFAULT_RESULT_LIMIT,
    mode = "recall",
    resultShape = "grouped",
    retrieveLimit,
    perItemEvidenceLimit = DEFAULT_PER_ITEM_EVIDENCE_LIMIT,
    useModelCompression = false,
  } = {}) {
    const normalizedMode = mode === "fast" ? "fast" : "recall";
    const normalizedShape = resultShape === "flat" ? "flat" : "grouped";
    const normalizedLimit = normalizePositiveInteger(limit, DEFAULT_RESULT_LIMIT);
    const normalizedRetrieveLimit = normalizePositiveInteger(
      retrieveLimit,
      normalizedMode === "fast" ? DEFAULT_FAST_RETRIEVE_LIMIT : DEFAULT_RECALL_RETRIEVE_LIMIT,
    );
    const normalizedPerItemEvidenceLimit = normalizePositiveInteger(
      perItemEvidenceLimit,
      DEFAULT_PER_ITEM_EVIDENCE_LIMIT,
    );
    const items = await this.zoteroClient.listItems({
      query: "",
      itemKeys,
      tags,
      collections,
      years,
      limit: Math.max(normalizedRetrieveLimit * 10, 5000),
    });

    const eligibleItems = items.filter(
      (item) => !itemKeys || itemKeys.length === 0 || itemKeys.includes(item.key),
    );

    const itemByKey = new Map(eligibleItems.map((item) => [item.key, item]));
    const expandedSearch = this.linklyClient.searchDocumentsExpanded
      ? await this.linklyClient.searchDocumentsExpanded({
          query,
          mode: normalizedMode,
          retrieveLimit: normalizedRetrieveLimit,
        })
      : {
          results: await this.linklyClient.searchDocuments({
            query,
            limit: Math.min(normalizedRetrieveLimit, 50),
          }),
          diagnostics: {
            roundsExecuted: 1,
            queriesTried: [query],
            truncated: normalizedRetrieveLimit > 50,
            totalUniqueResults: Math.min(normalizedRetrieveLimit, 50),
          },
        };

    const linklyResults = Array.isArray(expandedSearch.results) ? expandedSearch.results : [];
    const mappedEvidence = [];
    for (const result of linklyResults) {
      const mapping = this.#resolveMapping(result);
      if (!mapping) {
        continue;
      }

      const item = await this.#getItem(itemByKey, mapping.itemKey);
      if (!item) {
        continue;
      }

      if (!matchesItemFilters(item, { itemKeys, tags, collections, years })) {
        continue;
      }

      const docId = result.doc_id || mapping.docId || null;
      if (!docId) {
        continue;
      }

      if (result.doc_id && typeof this.stateStore.recordDocId === "function") {
        this.stateStore.recordDocId(mapping.workspacePath, result.doc_id);
      }

      mappedEvidence.push(
        buildMappedEvidence({
          result,
          mapping,
          item,
          docId,
        }),
      );
    }

    const groupedEvidence = buildGroupedEvidence({
      records: mappedEvidence,
      query,
      itemByKey,
      perItemEvidenceLimit: normalizedPerItemEvidenceLimit,
    });
    const flattenedEvidence = flattenGroupedEvidence(groupedEvidence);
    const evidence =
      normalizedShape === "flat"
        ? flattenedEvidence.slice(0, normalizedLimit)
        : groupedEvidence.slice(0, normalizedLimit);

    const warnings = [];
    if (useModelCompression) {
      warnings.push(
        "Model compression is not implemented yet; returning rule-compressed summaries only.",
      );
    }

    return {
      mode: normalizedMode,
      resultShape: normalizedShape,
      retrievedCount: expandedSearch.diagnostics?.totalUniqueResults ?? linklyResults.length,
      mappedCount: mappedEvidence.length,
      groupedCount: groupedEvidence.length,
      evidence,
      diagnostics: {
        truncated:
          Boolean(expandedSearch.diagnostics?.truncated) ||
          (normalizedShape === "flat"
            ? flattenedEvidence.length > normalizedLimit
            : groupedEvidence.length > normalizedLimit),
        roundsExecuted: expandedSearch.diagnostics?.roundsExecuted ?? 1,
        queriesTried: expandedSearch.diagnostics?.queriesTried ?? [query],
        useModelCompression: Boolean(useModelCompression),
        modelCompressionApplied: false,
        retrieveLimit: normalizedRetrieveLimit,
        perItemEvidenceLimit: normalizedPerItemEvidenceLimit,
        warnings,
      },
    };
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

  async #getItem(itemByKey, itemKey) {
    if (itemByKey.has(itemKey)) {
      return itemByKey.get(itemKey);
    }

    const item = await this.zoteroClient.getItem(itemKey);
    if (item) {
      itemByKey.set(itemKey, item);
    }
    return item;
  }

  #resolveMapping(result) {
    return (
      this.stateStore.findMappingByDocId?.(result.doc_id) ||
      this.stateStore.findMappingByPath(
        normalizeWorkspacePath(result.path || result.filePath),
      ) ||
      this.stateStore.findMappingByPathSuffix?.(
        toWorkspaceSuffix(normalizeWorkspacePath(result.path || result.filePath)),
      ) ||
      null
    );
  }
}

function toWorkspaceSuffix(filePath) {
  const normalized = normalizeWorkspacePath(filePath);
  if (!normalized) {
    return normalized;
  }
  return normalized.replace(/^\.\.\./, "");
}

function normalizePositiveInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function matchesItemFilters(item, { itemKeys, tags, collections, years }) {
  if (itemKeys?.length && !itemKeys.includes(item.key)) {
    return false;
  }
  if (tags?.length) {
    const itemTags = new Set((item.tags || []).map((tag) => tag.tag));
    if (!tags.every((tag) => itemTags.has(tag))) {
      return false;
    }
  }
  if (collections?.length) {
    const itemCollections = new Set((item.collections || []).map((collection) => collection.key));
    if (!collections.every((collection) => itemCollections.has(collection))) {
      return false;
    }
  }
  if (years?.length) {
    const itemYear = String(item.date || "").match(/\d{4}/)?.[0];
    if (!itemYear || !years.includes(itemYear) && !years.includes(Number(itemYear))) {
      return false;
    }
  }
  return true;
}

function buildMappedEvidence({ result, mapping, item, docId }) {
  const workspacePath = normalizeWorkspacePath(mapping.workspacePath || result.path || result.filePath);
  const relevance = Number(result.relevance || 0);
  const snippet = String(result.snippet || result.summary || "").trim();
  const sourceWeight = getSourceWeight(mapping.sourceType);
  const evidenceScore = relevance + sourceWeight;

  return {
    evidenceId: `${mapping.itemKey}:${mapping.sourceType}:${mapping.sourceKey}:${docId}`,
    itemKey: mapping.itemKey,
    sourceType: mapping.sourceType,
    sourceKey: mapping.sourceKey,
    title: result.title || mapping.title || item.title,
    snippet,
    path: workspacePath,
    docId,
    citation: buildCitation(item),
    relevance,
    score: roundScore(evidenceScore),
    matchedQueries: Array.isArray(result.matchedQueries) ? result.matchedQueries : [],
  };
}

function buildGroupedEvidence({ records, query, itemByKey, perItemEvidenceLimit }) {
  const groups = new Map();
  for (const record of records) {
    const current = groups.get(record.itemKey) || [];
    current.push(record);
    groups.set(record.itemKey, current);
  }

  const groupedEvidence = [];
  for (const [itemKey, groupRecords] of groups.entries()) {
    const item = itemByKey.get(itemKey);
    if (!item) {
      continue;
    }

    const dedupedRecords = dedupeEvidenceRecords(groupRecords);
    const sortedRecords = dedupedRecords.sort(compareEvidenceRecords);
    const sourceTypes = Array.from(new Set(sortedRecords.map((record) => record.sourceType))).sort();
    const maxSnippetRelevance = Math.max(...sortedRecords.map((record) => Number(record.relevance || 0)));
    const hitCount = sortedRecords.length;
    const metadataBonus = computeMetadataBonus(item, query);
    const sourceDiversityBonus = Math.max(0, sourceTypes.length - 1) * 0.08;
    const hitCountBonus = Math.min(hitCount, 5) * 0.06;
    const workspacePriority = sourceTypes.includes("attachment") ? 0.06 : 0.03;
    const score = roundScore(
      maxSnippetRelevance + metadataBonus + sourceDiversityBonus + hitCountBonus + workspacePriority,
    );
    const evidence = sortedRecords
      .slice(0, perItemEvidenceLimit)
      .map(({ matchedQueries, relevance, ...record }) => ({
        ...record,
        relevance: roundScore(relevance),
        matchedQueries,
      }));

    groupedEvidence.push({
      itemKey,
      citation: buildCitation(item),
      title: item.title,
      score,
      hitCount,
      sourceTypes,
      summary: buildSummary(item, evidence),
      evidence,
    });
  }

  return groupedEvidence.sort(compareGroupedEvidence);
}

function flattenGroupedEvidence(groupedEvidence) {
  return groupedEvidence.flatMap((group) =>
    group.evidence.map((record) => ({
      ...record,
      itemScore: group.score,
      hitCount: group.hitCount,
      sourceTypes: group.sourceTypes,
      summary: group.summary,
    })),
  );
}

function dedupeEvidenceRecords(records) {
  const deduped = new Map();
  for (const record of records) {
    const fingerprint = buildSnippetFingerprint(record.snippet, record.sourceType);
    const current = deduped.get(fingerprint);
    if (!current || compareEvidenceRecords(record, current) < 0) {
      deduped.set(fingerprint, record);
    }
  }
  return Array.from(deduped.values());
}

function buildSnippetFingerprint(snippet, sourceType) {
  const tokens = String(snippet || "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
  const normalized = tokens.slice(0, 14).join(" ");
  return `${sourceType}:${normalized || "empty"}`;
}

function compareEvidenceRecords(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  if (right.relevance !== left.relevance) {
    return right.relevance - left.relevance;
  }
  return String(left.evidenceId).localeCompare(String(right.evidenceId));
}

function compareGroupedEvidence(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  if (right.hitCount !== left.hitCount) {
    return right.hitCount - left.hitCount;
  }
  return String(left.title || "").localeCompare(String(right.title || ""));
}

function computeMetadataBonus(item, query) {
  const needles = tokenizeQuery(query);
  if (needles.length === 0) {
    return 0;
  }

  let bonus = 0;
  const title = String(item.title || "").toLowerCase();
  const abstractNote = String(item.abstractNote || "").toLowerCase();
  const tags = (item.tags || []).map((tag) => String(tag.tag || "").toLowerCase());
  const collections = (item.collections || []).map((collection) =>
    String(collection.name || "").toLowerCase(),
  );

  if (needles.every((needle) => title.includes(needle))) {
    bonus += 0.15;
  }
  if (needles.some((needle) => abstractNote.includes(needle))) {
    bonus += 0.05;
  }
  if (tags.some((tag) => needles.some((needle) => tag.includes(needle)))) {
    bonus += 0.04;
  }
  if (collections.some((collection) => needles.some((needle) => collection.includes(needle)))) {
    bonus += 0.03;
  }

  return bonus;
}

function buildSummary(item, evidence) {
  const leadSnippet = evidence[0]?.snippet || "";
  if (!leadSnippet) {
    return `${item.title} yielded ${evidence.length} representative evidence hit(s).`;
  }
  return `${item.title}: ${leadSnippet.slice(0, 220)}`;
}

function getSourceWeight(sourceType) {
  if (sourceType === "attachment") {
    return 0.12;
  }
  if (sourceType === "annotation") {
    return 0.1;
  }
  if (sourceType === "note") {
    return 0.08;
  }
  return 0.02;
}

function roundScore(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}
