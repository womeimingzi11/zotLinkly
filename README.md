# zotLinkly

`zotLinkly` is a bridge between Zotero and Linkly for AI-assisted research workflows.

The project goal is narrow: let AI models access Zotero-managed papers, notes, and annotations through a Linkly-driven retrieval layer instead of a traditional RAG-first stack. It is not an AI writing suite.

## What It Does

- Exposes raw Zotero data through a thin local Zotero plugin
- Syncs Zotero-managed attachments and notes into a dedicated local workspace
- Uses Linkly as the full-text retrieval engine over that workspace
- Exposes a standalone MCP server with a small AI-facing tool surface
- Maps every retrieved evidence hit back to a Zotero `itemKey`

## Architecture

The runtime is split into two parts:

1. `zotlinkly-zotero-plugin`
   A thin Zotero-side bridge that exposes local JSON-RPC on `127.0.0.1:23121`

2. `zotlinkly-mcp`
   An external Node-based MCP server and sync layer that:
   - syncs Zotero data into `~/.zotlinkly/workspace`
   - talks to Linkly MCP
   - exposes high-level tools for AI models

Generated local state:

- `~/.zotlinkly/workspace/attachments/`
- `~/.zotlinkly/workspace/notes/`
- `~/.zotlinkly/state.db`

## MCP Tools

The current MCP surface is intentionally narrow:

- `search_items`
- `search_evidence`
- `read_context`
- `get_item_bundle`

### `search_evidence`

`search_evidence` supports two retrieval modes:

- `recall`
  Default. Multi-query high-recall retrieval with paper-level compression.
- `fast`
  Lower-latency retrieval with fewer Linkly rounds.

It also supports two result shapes:

- `grouped`
  Default. Returns paper-level groups with representative evidence snippets.
- `flat`
  Returns a flattened evidence list derived from compressed grouped results.

The retrieval pipeline is:

`retrieve -> filter -> map -> group -> rerank -> compress -> return`

This keeps Linkly recall high without sending hundreds of raw snippets directly to the model.

## Current Design Constraints

- Zotero is the system of record for bibliographic assets
- Linkly is the retrieval engine for full text and notes
- Only Zotero-managed assets should be searched
- No runtime dependency on `cookjohn/zotero-mcp`
- No RAG-style preprocessing inside the Zotero plugin

## Repository Layout

```text
src/
  clients/        Linkly and Zotero bridge clients
  services/       Library and evidence retrieval logic
  state/          SQLite mapping store
  sync/           Workspace sync and note export
  mcp/            MCP server and tool handlers
plugins/zotlinkly-zotero-plugin/addon/
  Thin Zotero plugin source
docs/
  Local development and packaging notes
test/
  Node test suite
```

## Requirements

- Node.js 20+
- Zotero 8
- Linkly Desktop with local MCP enabled

## Install

```bash
npm install
```

## Quick Start

### 1. Validate and package the Zotero plugin

```bash
npm run zotero:validate-package
```

This builds:

- `dist/zotlinkly@zotlinkly.local.xpi`
- `dist/updates.json`
- `dist/release-metadata.json`

### 2. Prepare an isolated Zotero development profile

```bash
npm run zotero:prepare-profile
```

This installs the packaged add-on into `~/.zotlinkly/zotero-dev-profile` and prints the Zotero launch command.

### 3. Launch Zotero with the isolated profile

After startup, verify the add-on state:

```bash
npm run zotero:diagnose-install
```

Expected checks:

- the add-on is registered
- `activationStatus` is `active`
- `127.0.0.1:23121` is listening

### 4. Check bridge connectivity

```bash
npm run doctor
```

### 5. Sync Zotero assets into the local workspace

```bash
npm run sync
```

### 6. Add the workspace to Linkly Desktop

Point Linkly at:

```text
~/.zotlinkly/workspace
```

Wait until Linkly finishes indexing before expecting `search_evidence` to return mapped Zotero results.

## Development Commands

```bash
npm test
npm run doctor
npm run sync
npm run zotero:dev
npm run zotero:validate-package
npm run zotero:prepare-profile
npm run zotero:diagnose-install
```

## Notes on Packaging and Sideloading

- The Zotero add-on is packaged as a bootstrap-style extension
- For app-profile sideload installs, Zotero may register the add-on disabled on first launch
- If `zotero:diagnose-install` shows the package is registered but inactive, open Zotero Add-ons once and enable `ZotLinkly Zotero Plugin`

More detailed plugin notes are in [docs/zotero-plugin-dev.md](./docs/zotero-plugin-dev.md).

## Status

Implemented:

- thin Zotero plugin bridge
- workspace sync into `~/.zotlinkly`
- SQLite mapping layer
- standalone MCP server
- high-recall compressed `search_evidence`
- packaging and install diagnostics for the Zotero add-on

Still dependent on local environment:

- Zotero must be running with the plugin active
- Linkly must have indexed the generated workspace

## License

[MIT](./LICENSE)
