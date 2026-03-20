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

test("zotero plugin addon ships a content script entrypoint", () => {
  const scriptPath = path.join(
    process.cwd(),
    "plugins",
    "zotlinkly-zotero-plugin",
    "addon",
    "content",
    "scripts",
    "zotlinkly-zotero-plugin.js",
  );
  assert.equal(fs.existsSync(scriptPath), true);
});

test("zotero plugin content script awaits Zotero.Items.getAll before filtering", () => {
  const scriptPath = path.join(
    process.cwd(),
    "plugins",
    "zotlinkly-zotero-plugin",
    "addon",
    "content",
    "scripts",
    "zotlinkly-zotero-plugin.js",
  );
  const source = fs.readFileSync(scriptPath, "utf8");

  assert.match(source, /async function getAllItems/);
  assert.match(source, /await Zotero\.Items\.getAll\(1,\s*false\)/);
  assert.doesNotMatch(source, /Zotero\.Items\.getAll\(1,\s*false\)\s*\.filter/);
});

test("zotero plugin content script guards annotations to file attachments and awaits tags", () => {
  const scriptPath = path.join(
    process.cwd(),
    "plugins",
    "zotlinkly-zotero-plugin",
    "addon",
    "content",
    "scripts",
    "zotlinkly-zotero-plugin.js",
  );
  const source = fs.readFileSync(scriptPath, "utf8");

  assert.match(source, /attachment\.isFileAttachment && !attachment\.isFileAttachment\(\)/);
  assert.match(source, /async function getTags/);
  assert.match(source, /await Zotero\.Tags\.getAll\(1\)/);
});

test("zotero plugin content script writes HTTP responses as UTF-8 bytes", () => {
  const scriptPath = path.join(
    process.cwd(),
    "plugins",
    "zotlinkly-zotero-plugin",
    "addon",
    "content",
    "scripts",
    "zotlinkly-zotero-plugin.js",
  );
  const source = fs.readFileSync(scriptPath, "utf8");
  const responseBuilder = source.slice(source.indexOf("function buildHttpResponse"));

  assert.match(source, /nsIConverterOutputStream/);
  assert.match(source, /converterOutput\.init\(output,\s*"UTF-8"\)/);
  assert.match(source, /converterOutput\.writeString\(responseText\)/);
  assert.match(source, /Connection: close\\r\\n\\r\\n/);
  assert.doesNotMatch(responseBuilder, /Content-Length:/);
});
