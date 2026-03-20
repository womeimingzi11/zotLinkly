export class ZoteroBridgeClient {
  constructor({ endpoint, fetchImpl = fetch }) {
    this.endpoint = endpoint.replace(/\/$/, "");
    this.fetch = fetchImpl;
  }

  async ping() {
    const result = await this.#rpc("ping", {});
    return result.status === "ok";
  }

  async listItems(params = {}) {
    return this.#rpc("list_items", params);
  }

  async getItem(itemKey) {
    return this.#rpc("get_item", { itemKey });
  }

  async listAttachments({ itemKey } = {}) {
    return this.#rpc("list_attachments", { itemKey });
  }

  async getAttachmentFilePath(attachmentKey) {
    return this.#rpc("get_attachment_file_path", { attachmentKey });
  }

  async listNotes({ itemKey } = {}) {
    return this.#rpc("list_notes", { itemKey });
  }

  async listAnnotations({ itemKey } = {}) {
    return this.#rpc("list_annotations", { itemKey });
  }

  async getCollections() {
    return this.#rpc("get_collections", {});
  }

  async getTags() {
    return this.#rpc("get_tags", {});
  }

  async getLibrarySnapshot() {
    return this.#rpc("get_library_snapshot", {});
  }

  async getChangeCursor() {
    const result = await this.#rpc("get_change_cursor", {});
    return result.cursor;
  }

  async #rpc(method, params) {
    const response = await this.fetch(`${this.endpoint}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method, params }),
    });

    if (!response.ok) {
      throw new Error(`Zotero bridge request failed: ${response.status}`);
    }
    const payload = await response.json();
    if (payload.error) {
      throw new Error(payload.error.message || "Zotero bridge error");
    }
    return payload.result;
  }
}
