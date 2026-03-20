import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  buildPackagePlan,
  buildUpdatesPayload,
  validateManifest,
} from "../src/zotero-plugin/package-plugin.js";

test("buildPackagePlan derives xpi output path from manifest id", () => {
  const plan = buildPackagePlan({
    repoRoot: "/workspace/repo",
    outputDir: "/workspace/repo/dist",
    manifest: {
      version: "0.1.0",
      author: "chenhan",
      applications: {
        zotero: {
          id: "zotlinkly@zotlinkly.local",
          update_url: "https://github.com/chenhan/zotLinkly/releases/latest/download/updates.json",
          strict_min_version: "6.999",
          strict_max_version: "8.0.*",
        },
      },
    },
  });

  assert.equal(
    plan.pluginRoot,
    path.join("/workspace/repo", "plugins", "zotlinkly-zotero-plugin", "addon"),
  );
  assert.equal(plan.pluginId, "zotlinkly@zotlinkly.local");
  assert.equal(
    plan.outputPath,
    path.join("/workspace/repo/dist", "zotlinkly@zotlinkly.local.xpi"),
  );
  assert.equal(
    plan.updatesPath,
    path.join("/workspace/repo/dist", "updates.json"),
  );
  assert.equal(
    plan.updateLink,
    "https://github.com/chenhan/zotLinkly/releases/download/v0.1.0/zotlinkly@zotlinkly.local.xpi",
  );
});

test("validateManifest enforces Zotero installer metadata requirements", () => {
  assert.doesNotThrow(() =>
    validateManifest({
      manifest_version: 2,
      author: "chenhan",
      applications: {
        zotero: {
          id: "zotlinkly@zotlinkly.local",
          update_url: "https://github.com/chenhan/zotLinkly/releases/latest/download/updates.json",
          strict_min_version: "6.999",
          strict_max_version: "8.0.*",
        },
      },
    }),
  );

  assert.throws(
    () =>
      validateManifest({
        manifest_version: 2,
        author: "chenhan",
        applications: {
          zotero: {
            id: "zotlinkly@zotlinkly.local",
            strict_min_version: "6.999",
            strict_max_version: "8.0.*",
          },
        },
      }),
    /update_url/,
  );
});

test("buildUpdatesPayload emits Zotero-compatible update manifest", () => {
  const payload = buildUpdatesPayload(
    {
      pluginId: "zotlinkly@zotlinkly.local",
      version: "0.1.0",
      updateLink:
        "https://github.com/chenhan/zotLinkly/releases/download/v0.1.0/zotlinkly@zotlinkly.local.xpi",
      strictMinVersion: "6.999",
      strictMaxVersion: "8.0.*",
    },
    { sha256: "abc123" },
  );

  assert.equal(
    payload.addons["zotlinkly@zotlinkly.local"].updates[0].applications.zotero.strict_max_version,
    "8.0.*",
  );
  assert.equal(
    payload.addons["zotlinkly@zotlinkly.local"].updates[0].sha256,
    "abc123",
  );
});
