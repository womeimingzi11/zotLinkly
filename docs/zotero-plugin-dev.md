# Zotero Plugin Development For `zotlinkly`

This repository now contains a thin Zotero-side bridge in:

- `plugins/zotlinkly-zotero-plugin/addon`

The goal of this plugin is narrow:

- expose raw Zotero data over a loopback-only HTTP JSON-RPC endpoint
- expose a simple change cursor for incremental sync
- avoid RAG, summarization, or AI-facing MCP logic inside Zotero

This plugin follows Zotero's bootstrap-extension shape:

- root `bootstrap.js`
- root `manifest.json`
- root `prefs.js`
- no WebExtension `background.scripts`

## What To Do First

Run:

```bash
npm run zotero:validate-package
npm run zotero:prepare-profile
```

Then launch Zotero with the command printed by `npm run zotero:prepare-profile`.

If you already know your Zotero profile directory and still want source loading, run:

```bash
npm run zotero:dev -- --profile-dir "/absolute/path/to/zotero/profile"
```

That command prints:

- the Zotero extension id
- the plugin source root
- the exact extension proxy file path to create inside the Zotero profile

## Package Install Workflow

The default validation path is now package-based and uses an isolated profile under `~/.zotlinkly/zotero-dev-profile`.

Run:

```bash
npm run zotero:validate-package
```

That command:

- builds the `.xpi`
- writes `dist/updates.json`
- writes `dist/release-metadata.json`
- validates that the package contains `manifest.json`, `bootstrap.js`, `prefs.js`, and `content/scripts/zotlinkly-zotero-plugin.js`

Then run:

```bash
npm run zotero:prepare-profile
```

That command:

- resets the isolated dev profile cache files
- copies the packaged `.xpi` into the profile `extensions/` directory
- prints the exact Zotero launch command with `-profile -purgecaches -jsdebugger -ZoteroDebugText`

After Zotero starts, inspect the install state with:

```bash
npm run zotero:diagnose-install
```

Expected hard checks:

1. `extensions.json` includes `zotlinkly@zotlinkly.local`
2. `127.0.0.1:23121` is listening
3. `npm run doctor` reports `zotero: ok`

## Source Loading Workflow

This project uses Zotero source loading rather than building an `.xpi` first.

The minimal workflow is:

1. Close Zotero.
2. Create an extension proxy file in the `extensions/` directory of the Zotero profile.
3. Name the file exactly the plugin id: `zotlinkly@zotlinkly.local`
4. Put the absolute plugin source path into that file:

```text
/absolute/path/to/this/repo/plugins/zotlinkly-zotero-plugin/addon
```

5. Open `prefs.js` in the same Zotero profile once and delete lines containing:
   - `extensions.lastAppBuildId`
   - `extensions.lastAppVersion`
6. Start Zotero again.

After Zotero starts, the bridge should listen on:

```text
http://127.0.0.1:23121/rpc
```

## Expected First Checks

Once the plugin is loaded, the next checks are:

1. Run `npm run doctor`
2. Confirm the Zotero side no longer reports `Zotero bridge request failed`
3. Add or edit a Zotero item with a PDF and a note
4. Run `npm run sync`
5. Confirm files appear under `~/.zotlinkly/workspace/attachments` and `~/.zotlinkly/workspace/notes`

Only after that should you connect Linkly indexing and test `search_evidence`.

## Release Artifacts

Package generation now produces:

```bash
npm run zotero:package
```

That writes:

- `dist/zotlinkly@zotlinkly.local.xpi`
- `dist/updates.json`
- `dist/release-metadata.json`

The manifest inside the packaged `.xpi` includes `applications.zotero.update_url`, and the release metadata includes the computed `sha256` hash for GitHub Releases publishing.
