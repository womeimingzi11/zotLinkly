export function buildToolHandlers({ libraryService, evidenceService }) {
  return {
    async search_items(input) {
      return { items: await libraryService.searchItems(input) };
    },
    async search_evidence(input) {
      return { evidence: await evidenceService.searchEvidence(input) };
    },
    async read_context(input) {
      return { result: await evidenceService.readContext(input) };
    },
    async get_item_bundle(input) {
      return { bundle: await libraryService.getItemBundle(input) };
    },
  };
}
