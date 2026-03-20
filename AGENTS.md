# AGENTS.md

## Project Purpose

`zotlinkly` is a two-part bridge between Zotero and Linkly for AI workflows.

The goal is not to build an AI writing suite. The goal is to let AI models access Zotero-managed research assets through a Linkly-driven retrieval layer instead of a traditional RAG-first workflow.

## Core Product Decisions

These decisions were established during project initialization and should be treated as default constraints unless explicitly revised.

1. The runtime architecture is split into two parts:
   - `zotlinkly-zotero-plugin`: a thin Zotero-side bridge
   - `zotlinkly-mcp`: an external MCP server and sync layer
2. Do not depend on `cookjohn/zotero-mcp` at runtime.
   - It may be referenced or forked only to reuse Zotero-internal access patterns or lightweight HTTP plumbing.
   - Its existing MCP, RAG, search, and content-processing layers are out of scope for this project.
3. Zotero remains the system of record for bibliographic assets.
4. Linkly is the retrieval engine for full-text and note search.
5. The bridge must only search Zotero-managed assets.
   - Do not mix in unrelated Linkly-local documents.
6. The AI-facing interface must be a standalone MCP server.
7. The external MCP server should expose high-level research tools, not raw Zotero or Linkly tools.
8. The Zotero plugin must stay thin.
   - It should expose raw RPC and a change cursor.
   - It must not implement RAG, summarization, or AI-oriented filtering.
9. Sync should be incremental and automatic in the long-running server flow.
   - The first baseline sync may still be triggered explicitly during setup or recovery.

## Current Repository Shape

- `src/`
  External Node/TypeScript-style ESM implementation for:
  - state store
  - workspace sync
  - Linkly client
  - Zotero bridge client
  - MCP server
  - CLI helpers
- `plugins/zotlinkly-zotero-plugin/addon/`
  Thin Zotero plugin source tree
- `docs/zotero-plugin-dev.md`
  Local development, package validation, and install-diagnostics notes
- `test/`
  Node test coverage for:
  - workspace sync
  - evidence mapping
  - MCP tool handlers
  - Zotero dev install helpers

## AI-Facing MCP Surface

The external MCP server should keep the public tool surface narrow:

- `search_items`
- `search_evidence`
- `read_context`
- `get_item_bundle`

All evidence returned from Linkly must map back to a Zotero `itemKey`. Unmapped results must be dropped.

## Sync Model

The external service maintains a Zotero-only workspace under `~/.zotlinkly/`:

- `workspace/attachments/`
  symlinks to Zotero-managed attachment files
- `workspace/notes/`
  generated Markdown mirrors combining notes, annotations, and item metadata
- `state.db`
  local SQLite mapping store for item/source/workspace/doc relationships

The current implementation expects:

- raw items, attachments, notes, and annotations from the Zotero bridge
- Linkly indexing to target only the generated workspace

## Zotero Plugin Notes

The plugin is intentionally minimal.

- It should listen on loopback only.
- It should expose JSON-RPC at `http://127.0.0.1:23121/rpc`.
- It should provide at least:
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

Prefer Zotero's internal JS APIs over direct SQLite access.

The plugin package must be installable as a Zotero 8 add-on, not only source-loadable.

- `manifest.json` must include `applications.zotero.update_url`
- `strict_max_version` is currently pinned to `8.0.*`
- package validation should happen before runtime bridge debugging
- for app-profile sideload installs, Zotero may register the add-on disabled on first launch; confirm `userDisabled: false` before treating it as a runtime failure

## Version Control Policy

This repository is managed with `jj`.

- The repo was initialized with `jj git init`.
- Use `jj` for local version control operations.
- Keep changes committed in small, meaningful units.
- Commit all meaningful changes.
- Do not leave substantive work uncommitted.
- The only likely exception is trivial typo-only cleanup.

## Commands

- `npm test`
  Run the current automated test suite
- `npm run doctor`
  Check basic connectivity assumptions for Zotero and Linkly
- `npm run sync`
  Force a sync pass through the external service
- `npm run zotero:dev`
  Print the local Zotero source-loading instructions for the plugin
- `npm run zotero:validate-package`
  Build the `.xpi`, `updates.json`, and release metadata, then validate the packaged artifact
- `npm run zotero:prepare-profile`
  Reset and prepare an isolated Zotero development profile with the packaged addon installed
- `npm run zotero:diagnose-install`
  Inspect install registration, cache state, port listening, and bridge reachability for a Zotero profile

## Current Status

The repository already contains:

- a working external MCP/server skeleton
- a workspace sync implementation
- a SQLite-backed mapping layer
- a thin Zotero plugin skeleton
- a local Zotero development helper command

The main missing step is real local integration with a running Zotero instance and a running Linkly desktop MCP endpoint.

## Next Steps

Follow this order:

1. Run `npm run zotero:validate-package`.
2. Run `npm run zotero:prepare-profile`.
3. Launch Zotero using the printed isolated-profile command.
4. Run `npm run zotero:diagnose-install` and make sure the add-on is registered before debugging bridge logic.
5. Run `npm run doctor` and make sure the Zotero bridge becomes reachable on `127.0.0.1:23121`.
6. Create or edit a Zotero item with:
   - one attachment
   - one note
   - at least one annotation if possible
7. Run `npm run sync` and confirm files appear under `~/.zotlinkly/workspace/`.
8. Point Linkly Desktop at that workspace if it is not already indexed.
9. Only then test `search_evidence` and `read_context` end to end.

## Notes For Future Agents

- Do not expand scope into automatic writing or literature review generation unless explicitly requested.
- Do not reintroduce a `zotero-mcp`-style prefiltered retrieval layer.
- When in doubt, keep Zotero-side logic raw and externalize orchestration to the MCP server.
