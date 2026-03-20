import { stripHtml, buildCitation, ensureArray } from "../utils/text.js";

function yamlLine(key, value) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${key}: []`;
    }
    return `${key}:\n${value.map((entry) => `  - "${String(entry).replace(/"/g, '\\"')}"`).join("\n")}`;
  }
  if (value == null || value === "") {
    return `${key}: ""`;
  }
  const scalar = String(value);
  if (/^[A-Za-z0-9 _./:-]+$/.test(scalar)) {
    return `${key}: ${scalar}`;
  }
  return `${key}: "${scalar.replace(/"/g, '\\"')}"`;
}

export function renderItemMarkdown({ item, attachments, notes, annotations }) {
  const creators = ensureArray(item.creators).map((creator) =>
    [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim() ||
    creator.name ||
    "Unknown",
  );
  const tags = ensureArray(item.tags).map((tag) => tag.tag).filter(Boolean);
  const collections = ensureArray(item.collections)
    .map((collection) => collection.name)
    .filter(Boolean);
  const attachmentRefs = ensureArray(attachments).map((attachment) => attachment.key);

  const frontmatter = [
    "---",
    yamlLine("itemKey", item.key),
    yamlLine("title", item.title),
    yamlLine("year", String(item.date || "").match(/\d{4}/)?.[0] || ""),
    yamlLine("citation", buildCitation(item)),
    yamlLine("authors", creators),
    yamlLine("tags", tags),
    yamlLine("collections", collections),
    yamlLine("attachments", attachmentRefs),
    "---",
    "",
  ].join("\n");

  const sections = [
    `# ${item.title || item.key}`,
    "",
    "## Metadata",
    "",
    `- Item Key: ${item.key}`,
    `- Citation: ${buildCitation(item)}`,
    item.publicationTitle ? `- Source: ${item.publicationTitle}` : null,
    item.abstractNote ? "" : null,
    item.abstractNote ? "## Abstract" : null,
    item.abstractNote ? "" : null,
    item.abstractNote ? stripHtml(item.abstractNote) : null,
    notes.length > 0 ? "" : null,
    notes.length > 0 ? "## Notes" : null,
    ...notes.flatMap((note) => ["", `### ${note.title || note.key}`, "", stripHtml(note.note)]),
    annotations.length > 0 ? "" : null,
    annotations.length > 0 ? "## Annotations" : null,
    ...annotations.flatMap((annotation) => [
      "",
      `### ${annotation.key}`,
      "",
      annotation.pageLabel ? `- Page: ${annotation.pageLabel}` : null,
      annotation.color ? `- Color: ${annotation.color}` : null,
      annotation.annotationText ? `- Highlight: ${annotation.annotationText}` : null,
      annotation.comment ? `- Comment: ${annotation.comment}` : null,
    ]),
  ]
    .filter(Boolean)
    .join("\n");

  return `${frontmatter}${sections}\n`;
}
