import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { buildPackageInstallPlan } from "./dev-install.js";
import { getConfig } from "../config.js";
import { ZoteroBridgeClient } from "../clients/zotero-client.js";

const execFileAsync = promisify(execFile);

async function isPortListening(port) {
  try {
    const { stdout } = await execFileAsync("lsof", [
      "-nP",
      `-iTCP:${String(port)}`,
      "-sTCP:LISTEN",
    ]);
    return stdout.trim().length > 0;
  } catch (_error) {
    return false;
  }
}

function readExtensionsEntry(extensionsJsonPath, pluginId) {
  if (!fs.existsSync(extensionsJsonPath)) {
    return null;
  }
  try {
    const payload = JSON.parse(fs.readFileSync(extensionsJsonPath, "utf8"));
    return payload.addons?.find((addon) => addon.id === pluginId) || null;
  } catch (_error) {
    return null;
  }
}

function readZoteroVersion(appPath) {
  const appRoot = path.dirname(path.dirname(appPath));
  const candidatePaths = [
    path.join(appRoot, "Resources", "app", "application.ini"),
    path.join(appRoot, "Resources", "application.ini"),
  ];

  for (const iniPath of candidatePaths) {
    if (!fs.existsSync(iniPath)) {
      continue;
    }
    const source = fs.readFileSync(iniPath, "utf8");
    const match = source.match(/^Version=(.+)$/m);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

async function pingBridge(endpoint) {
  const client = new ZoteroBridgeClient({ endpoint });
  try {
    await client.ping();
    return "ok";
  } catch (error) {
    return error?.message || String(error);
  }
}

export async function collectInstallDiagnostics({
  repoRoot = process.cwd(),
  profileDir,
  appPath,
  endpoint = getConfig().zoteroEndpoint,
} = {}) {
  const plan = buildPackageInstallPlan({
    repoRoot,
    profileDir,
    appPath,
  });
  const extensionEntry = readExtensionsEntry(plan.extensionsJsonPath, plan.pluginId);
  const prefsSource = fs.existsSync(plan.prefsPath)
    ? fs.readFileSync(plan.prefsPath, "utf8")
    : "";
  const portMatch = endpoint.match(/:(\d+)$/);
  const port = portMatch ? Number(portMatch[1]) : 23121;

  const activationStatus = !extensionEntry
    ? "not_registered"
    : extensionEntry.userDisabled
      ? "disabled_in_addons_ui"
      : extensionEntry.active
        ? "active"
        : "registered_but_inactive";
  const activationHint =
    activationStatus === "disabled_in_addons_ui"
      ? "The add-on is installed but disabled. Open Zotero Add-ons and enable ZotLinkly once."
      : activationStatus === "registered_but_inactive"
        ? "The add-on is registered but not active yet. Restart Zotero and inspect the Browser Console for bootstrap errors."
        : null;

  return {
    profileDir: plan.profileDir,
    zoteroAppPath: plan.appPath,
    zoteroVersion: readZoteroVersion(plan.appPath),
    endpoint,
    installedXpiPath: plan.installedXpiPath,
    installedXpiPresent: fs.existsSync(plan.installedXpiPath),
    proxyFilePath: plan.proxyFilePath,
    proxyFilePresent: fs.existsSync(plan.proxyFilePath),
    extensionsJsonPath: plan.extensionsJsonPath,
    addonStartupPath: plan.addonStartupPath,
    registeredInExtensionsJson: Boolean(extensionEntry),
    activationStatus,
    activationHint,
    extensionEntry,
    prefsPath: plan.prefsPath,
    prefsCacheKeysPresent:
      prefsSource.includes("extensions.lastAppBuildId") ||
      prefsSource.includes("extensions.lastAppVersion"),
    bridgePort: port,
    bridgePortListening: await isPortListening(port),
    bridgePing: await pingBridge(endpoint),
  };
}
