import { buildCitation, matchesQuery } from "../utils/text.js";

export class LibraryService {
  constructor({ zoteroClient }) {
    this.zoteroClient = zoteroClient;
  }

  async searchItems({ query, tags = [], collections = [], years = [], limit = 10 } = {}) {
    const items = await this.zoteroClient.listItems({
      query,
      tags,
      collections,
      years,
      limit,
    });

    return items
      .filter((item) => matchesQuery(item, query))
      .filter((item) => matchesSet(item.tags?.map((tag) => tag.tag), tags))
      .filter((item) => matchesSet(item.collections?.map((collection) => collection.key), collections))
      .filter((item) => matchesYear(item.date, years))
      .slice(0, limit)
      .map((item) => ({
        itemKey: item.key,
        title: item.title,
        year: String(item.date || "").match(/\d{4}/)?.[0] || null,
        creators: item.creators || [],
        publicationTitle: item.publicationTitle || null,
        tags: item.tags || [],
        collections: item.collections || [],
        hasAttachments: Boolean(item.hasAttachments ?? item.numAttachments ?? false),
        hasNotes: Boolean(item.hasNotes ?? item.numNotes ?? false),
        citation: buildCitation(item),
      }));
  }

  async getItemBundle({ itemKey }) {
    const [item, attachments, notes, annotations] = await Promise.all([
      this.zoteroClient.getItem(itemKey),
      this.zoteroClient.listAttachments({ itemKey }),
      this.zoteroClient.listNotes({ itemKey }),
      this.zoteroClient.listAnnotations({ itemKey }),
    ]);

    return {
      item,
      citation: buildCitation(item),
      attachments,
      notes,
      annotations,
    };
  }
}

function matchesSet(values = [], filterValues = []) {
  if (!filterValues || filterValues.length === 0) {
    return true;
  }
  const set = new Set((values || []).filter(Boolean));
  return filterValues.every((value) => set.has(value));
}

function matchesYear(date, years = []) {
  if (!years || years.length === 0) {
    return true;
  }
  const year = String(date || "").match(/\d{4}/)?.[0];
  return year ? years.includes(Number(year)) || years.includes(year) : false;
}
