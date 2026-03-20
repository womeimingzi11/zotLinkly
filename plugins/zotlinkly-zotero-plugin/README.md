# zotlinkly-zotero-plugin

This is the thin Zotero-side bridge for `zotlinkly-mcp`.

Design constraints:

- Expose raw Zotero data and change notifications only
- No RAG, semantic retrieval, summarization, or MCP tool layer
- No Linkly-specific indexing logic

RPC surface:

- `ping`
- `list_items`
- `get_item`
- `list_attachments`
- `get_attachment_file_path`
- `list_notes`
- `list_annotations`
- `get_collections`
- `get_tags`
- `get_library_snapshot`
- `get_change_cursor`

The intended transport is a loopback-only HTTP JSON-RPC endpoint at `/rpc`.

Default endpoint:

- `http://127.0.0.1:23121/rpc`
