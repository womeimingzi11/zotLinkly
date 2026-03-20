import fs from "node:fs";
import path from "node:path";

export function resolvePluginRoot(repoRoot = process.cwd()) {
  return path.join(repoRoot, "plugins", "zotlinkly-zotero-plugin", "addon");
}

export function readPluginManifest(pluginRoot) {
  const manifestPath = path.join(pluginRoot, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return { manifestPath, manifest };
}

export function buildProxyInstallPlan({
  repoRoot = process.cwd(),
  profileDir = null,
  manifest = null,
} = {}) {
  const pluginRoot = resolvePluginRoot(repoRoot);
  const pluginManifest = manifest || readPluginManifest(pluginRoot).manifest;
  const pluginId = pluginManifest?.applications?.zotero?.id;

  if (!pluginId) {
    throw new Error(`Missing Zotero extension id in ${path.join(pluginRoot, "manifest.json")}`);
  }

  return {
    pluginId,
    pluginRoot,
    proxyFilePath: profileDir
      ? path.join(profileDir, "extensions", pluginId)
      : null,
  };
}
