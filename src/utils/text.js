import path from "node:path";

const SEARCH_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

export function slugify(input) {
  return String(input || "untitled")
    .normalize("NFKD")
    .replace(/[^\w\s.-]+/g, "")
    .trim()
    .replace(/[\s._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

export function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extensionForPath(filePath, contentType = "") {
  const ext = path.extname(filePath || "");
  if (ext) {
    return ext;
  }
  if (contentType === "application/pdf") {
    return ".pdf";
  }
  if (contentType === "application/epub+zip") {
    return ".epub";
  }
  return "";
}

export function buildCitation(item) {
  const creators = Array.isArray(item?.creators) ? item.creators : [];
  const creatorPart =
    creators.length === 0
      ? "Unknown author"
      : creators
          .slice(0, 2)
          .map((creator) => creator.lastName || creator.name || "Unknown")
          .join(", ");
  const year = String(item?.date || "").match(/\d{4}/)?.[0] || "n.d.";
  const title = item?.title || "Untitled";
  return `${creatorPart} (${year}). ${title}.`;
}

export function matchesQuery(item, query) {
  if (!query) {
    return true;
  }
  const needles = String(query)
    .toLowerCase()
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const haystack = [
    item?.title,
    item?.abstractNote,
    item?.publicationTitle,
    ...(item?.creators || []).flatMap((creator) => [
      creator.firstName,
      creator.lastName,
      creator.name,
    ]),
    ...(item?.tags || []).map((tag) => tag.tag),
    ...(item?.collections || []).map((collection) => collection.name),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
    .join("\n");

  return needles.every((needle) => haystack.includes(needle));
}

export function tokenizeQuery(query) {
  return String(query || "")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
}

export function buildSearchQueries(query, { mode = "recall" } = {}) {
  const rawQuery = String(query || "").trim().replace(/\s+/g, " ");
  if (!rawQuery) {
    return [];
  }

  const tokens = tokenizeQuery(rawQuery);
  const significantTokens = tokens.filter(
    (token) => token.length >= 3 && !SEARCH_STOPWORDS.has(token),
  );
  const queries = [];
  const addQuery = (value) => {
    const normalized = String(value || "").trim().replace(/\s+/g, " ");
    if (normalized && !queries.includes(normalized)) {
      queries.push(normalized);
    }
  };

  addQuery(rawQuery);
  if (tokens.length > 1) {
    addQuery(`"${rawQuery}"`);
    addQuery(tokens.slice().reverse().join(" "));
  }

  if (mode === "fast") {
    significantTokens.slice(0, 2).forEach(addQuery);
    return queries.slice(0, 3);
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    addQuery(`${tokens[index]} ${tokens[index + 1]}`);
  }

  for (let index = 0; index < tokens.length - 2; index += 1) {
    addQuery(`${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`);
  }

  significantTokens.forEach(addQuery);

  return queries.slice(0, 12);
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeWorkspacePath(filePath) {
  return String(filePath || "").replace(/\\/g, "/");
}
