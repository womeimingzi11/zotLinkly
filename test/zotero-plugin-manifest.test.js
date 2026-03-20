import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("zotero plugin manifest declares Zotero 8 compatibility", () => {
  const manifestPath = path.join(
    process.cwd(),
    "plugins",
    "zotlinkly-zotero-plugin",
    "addon",
    "manifest.json",
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.manifest_version, 2);
  assert.equal(manifest.applications.zotero.id, "zotlinkly@zotlinkly.local");
  assert.equal(manifest.applications.zotero.strict_min_version, "6.999");
  assert.equal(manifest.applications.zotero.strict_max_version, "9.*");
});
