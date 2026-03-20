import fs from "node:fs";
import os from "node:os";
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

export function getDefaultDevProfileDir(homeDir = os.homedir()) {
  return path.join(homeDir, ".zotlinkly", "zotero-dev-profile");
}

export function buildPackageInstallPlan({
  repoRoot = process.cwd(),
  profileDir = getDefaultDevProfileDir(),
  manifest = null,
  packagePath = null,
  appPath = "/Applications/Zotero.app/Contents/MacOS/zotero",
} = {}) {
  const pluginRoot = resolvePluginRoot(repoRoot);
  const pluginManifest = manifest || readPluginManifest(pluginRoot).manifest;
  const pluginId = pluginManifest?.applications?.zotero?.id;

  if (!pluginId) {
    throw new Error(`Missing Zotero extension id in ${path.join(pluginRoot, "manifest.json")}`);
  }

  const resolvedProfileDir = path.resolve(profileDir);
  const extensionsDir = path.join(resolvedProfileDir, "extensions");
  const installedXpiPath = path.join(extensionsDir, `${pluginId}.xpi`);
  const proxyFilePath = path.join(extensionsDir, pluginId);

  return {
    pluginId,
    pluginRoot,
    profileDir: resolvedProfileDir,
    extensionsDir,
    installedXpiPath,
    proxyFilePath,
    packagePath: packagePath || path.join(repoRoot, "dist", `${pluginId}.xpi`),
    prefsPath: path.join(resolvedProfileDir, "prefs.js"),
    extensionsJsonPath: path.join(resolvedProfileDir, "extensions.json"),
    addonStartupPath: path.join(resolvedProfileDir, "addonStartup.json.lz4"),
    appPath,
    launchArgs: ["-profile", resolvedProfileDir, "-purgecaches", "-jsdebugger", "-ZoteroDebugText"],
  };
}

export function stripExtensionCachePrefs(source) {
  return source
    .split(/\r?\n/)
    .filter(
      (line) =>
        !line.includes("extensions.lastAppBuildId") &&
        !line.includes("extensions.lastAppVersion"),
    )
    .join("\n");
}

export function prepareInstallProfile(plan) {
  fs.mkdirSync(plan.extensionsDir, { recursive: true });

  const backups = [];
  for (const filePath of [
    plan.installedXpiPath,
    plan.proxyFilePath,
    plan.extensionsJsonPath,
    plan.addonStartupPath,
  ]) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const backupPath = `${filePath}.${Date.now()}.bak`;
    fs.renameSync(filePath, backupPath);
    backups.push({ originalPath: filePath, backupPath });
  }

  if (fs.existsSync(plan.prefsPath)) {
    const source = fs.readFileSync(plan.prefsPath, "utf8");
    const cleaned = stripExtensionCachePrefs(source);
    if (cleaned !== source) {
      fs.writeFileSync(plan.prefsPath, cleaned);
    }
  }

  fs.copyFileSync(plan.packagePath, plan.installedXpiPath);

  return {
    ...plan,
    backups,
    launchCommand: `"${plan.appPath}" ${plan.launchArgs.join(" ")}`,
  };
}
