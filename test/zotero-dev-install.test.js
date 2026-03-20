import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  buildPackageInstallPlan,
  buildProxyInstallPlan,
  getDefaultDevProfileDir,
  resolvePluginRoot,
  stripExtensionCachePrefs,
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

test("default dev profile directory stays under ~/.zotlinkly", () => {
  assert.equal(
    getDefaultDevProfileDir("/Users/test"),
    path.join("/Users/test", ".zotlinkly", "zotero-dev-profile"),
  );
});

test("buildPackageInstallPlan targets isolated profile cleanup and install paths", () => {
  const plan = buildPackageInstallPlan({
    repoRoot: "/workspace/repo",
    profileDir: "/Users/test/.zotlinkly/zotero-dev-profile",
    manifest: {
      applications: {
        zotero: {
          id: "zotlinkly@zotlinkly.local",
        },
      },
    },
  });

  assert.equal(
    plan.installedXpiPath,
    path.join(
      "/Users/test/.zotlinkly/zotero-dev-profile",
      "extensions",
      "zotlinkly@zotlinkly.local.xpi",
    ),
  );
  assert.equal(
    plan.extensionsJsonPath,
    path.join("/Users/test/.zotlinkly/zotero-dev-profile", "extensions.json"),
  );
  assert.match(plan.launchArgs.join(" "), /-purgecaches/);
  assert.match(plan.launchArgs.join(" "), /-jsdebugger/);
  assert.match(plan.launchArgs.join(" "), /-ZoteroDebugText/);
});

test("stripExtensionCachePrefs removes Zotero extension cache keys only", () => {
  const cleaned = stripExtensionCachePrefs(
    [
      'user_pref("extensions.lastAppBuildId", "x");',
      'user_pref("extensions.lastAppVersion", "8.0.4");',
      'user_pref("extensions.keep", "y");',
    ].join("\n"),
  );

  assert.equal(cleaned.includes("lastAppBuildId"), false);
  assert.equal(cleaned.includes("lastAppVersion"), false);
  assert.equal(cleaned.includes('user_pref("extensions.keep", "y");'), true);
});
