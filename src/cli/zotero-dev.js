import path from "node:path";

import { buildProxyInstallPlan } from "../zotero-plugin/dev-install.js";

const args = process.argv.slice(2);
const profileDirArgIndex = args.indexOf("--profile-dir");
const profileDir =
  profileDirArgIndex >= 0 && args[profileDirArgIndex + 1]
    ? path.resolve(args[profileDirArgIndex + 1])
    : null;

const plan = buildProxyInstallPlan({
  repoRoot: process.cwd(),
  profileDir,
});

const lines = [
  `Plugin ID: ${plan.pluginId}`,
  `Plugin source root: ${plan.pluginRoot}`,
];

if (plan.proxyFilePath) {
  lines.push(`Extension proxy file: ${plan.proxyFilePath}`);
}

lines.push("");
lines.push("Zotero source-loading steps:");
lines.push("1. Close Zotero.");
if (plan.proxyFilePath) {
  lines.push(
    `2. Create a text file at ${plan.proxyFilePath} whose content is exactly:`,
  );
  lines.push(`   ${plan.pluginRoot}`);
} else {
  lines.push("2. Find your Zotero profile directory, then create extensions/<plugin-id> there.");
  lines.push(`   File name: ${plan.pluginId}`);
  lines.push(`   File content: ${plan.pluginRoot}`);
}
lines.push(
  "3. In the same Zotero profile directory, open prefs.js once and delete any lines containing extensions.lastAppBuildId or extensions.lastAppVersion.",
);
lines.push(
  "4. Restart Zotero. The plugin should appear in Tools -> Add-ons and start its loopback RPC bridge on 127.0.0.1:23120.",
);
lines.push(
  "5. For later code changes, restart Zotero; if Zotero caches old files, relaunch it with -purgecaches.",
);

console.log(lines.join("\n"));
