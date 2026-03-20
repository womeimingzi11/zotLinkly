import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("zotero plugin manifest stays in bootstrap-extension shape", () => {
  const manifestPath = path.join(
    process.cwd(),
    "plugins",
    "zotlinkly-zotero-plugin",
    "addon",
    "manifest.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.manifest_version, 2);
  assert.equal("background" in manifest, false);
});

test("zotero plugin addon root includes prefs.js for bootstrap compatibility", () => {
  const prefsPath = path.join(
    process.cwd(),
    "plugins",
    "zotlinkly-zotero-plugin",
    "addon",
    "prefs.js",
  );
  assert.equal(fs.existsSync(prefsPath), true);
});
