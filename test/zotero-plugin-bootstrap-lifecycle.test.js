import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("bootstrap addon exports standard lifecycle functions", () => {
  const bootstrapPath = path.join(
    process.cwd(),
    "plugins",
    "zotlinkly-zotero-plugin",
    "addon",
    "bootstrap.js",
  );
  const source = fs.readFileSync(bootstrapPath, "utf8");

  assert.match(source, /function install\s*\(/);
  assert.match(source, /function startup\s*\(/);
  assert.match(source, /function shutdown\s*\(/);
  assert.match(source, /function uninstall\s*\(/);
});

test("bootstrap startup uses Zotero bootstrap-compatible signature", () => {
  const bootstrapPath = path.join(
    process.cwd(),
    "plugins",
    "zotlinkly-zotero-plugin",
    "addon",
    "bootstrap.js",
  );
  const source = fs.readFileSync(bootstrapPath, "utf8");

  assert.match(source, /function startup\s*\(\s*\{[^}]*rootURI[^}]*\}\s*,\s*reason\s*\)/);
  assert.match(source, /function shutdown\s*\(\s*\{[^}]*rootURI[^}]*\}\s*,\s*reason\s*\)/);
});
