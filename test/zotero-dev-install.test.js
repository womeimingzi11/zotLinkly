import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  buildProxyInstallPlan,
  resolvePluginRoot,
} from "../src/zotero-plugin/dev-install.js";

test("resolvePluginRoot points at the addon directory that Zotero should load from source", () => {
  const pluginRoot = resolvePluginRoot("/workspace/repo");
  assert.equal(
    pluginRoot,
    path.join("/workspace/repo", "plugins", "zotlinkly-zotero-plugin", "addon"),
  );
});

test("buildProxyInstallPlan derives extension proxy metadata from manifest", () => {
  const plan = buildProxyInstallPlan({
    repoRoot: "/workspace/repo",
    profileDir: "/Users/test/Zotero/dev-profile",
    manifest: {
      applications: {
        zotero: {
          id: "zotlinkly@zotlinkly.local",
        },
      },
    },
  });

  assert.equal(plan.pluginId, "zotlinkly@zotlinkly.local");
  assert.equal(
    plan.pluginRoot,
    path.join("/workspace/repo", "plugins", "zotlinkly-zotero-plugin", "addon"),
  );
  assert.equal(
    plan.proxyFilePath,
    path.join("/Users/test/Zotero/dev-profile", "extensions", "zotlinkly@zotlinkly.local"),
  );
});

test("plugin id uses a gecko-compatible email-like format", () => {
  const plan = buildProxyInstallPlan({
    repoRoot: process.cwd(),
  });

  assert.match(plan.pluginId, /^[^@]+@[^@]+\.[^@]+$/);
  assert.equal(
    plan.proxyFilePath,
    null,
  );
});
