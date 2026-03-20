import path from "node:path";

import { packagePlugin } from "../zotero-plugin/package-plugin.js";
import {
  buildPackageInstallPlan,
  prepareInstallProfile,
} from "../zotero-plugin/dev-install.js";

const args = process.argv.slice(2);
const profileDirArgIndex = args.indexOf("--profile-dir");
const appPathArgIndex = args.indexOf("--app-path");

const profileDir =
  profileDirArgIndex >= 0 && args[profileDirArgIndex + 1]
    ? path.resolve(args[profileDirArgIndex + 1])
    : undefined;
const appPath =
  appPathArgIndex >= 0 && args[appPathArgIndex + 1]
    ? path.resolve(args[appPathArgIndex + 1])
    : undefined;

const packagePlan = await packagePlugin();
const installPlan = buildPackageInstallPlan({
  repoRoot: process.cwd(),
  profileDir,
  appPath,
  packagePath: packagePlan.outputPath,
});
const prepared = prepareInstallProfile(installPlan);

console.log(
  [
    `Prepared profile: ${prepared.profileDir}`,
    `Installed package: ${prepared.installedXpiPath}`,
    `Plugin ID: ${prepared.pluginId}`,
    `Launch command: ${prepared.launchCommand}`,
    prepared.backups.length > 0 ? "Backups:" : "Backups: none",
    ...prepared.backups.map(
      (entry) => `- ${entry.originalPath} -> ${entry.backupPath}`,
    ),
  ].join("\n"),
);
