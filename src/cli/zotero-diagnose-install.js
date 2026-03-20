import path from "node:path";

import { collectInstallDiagnostics } from "../zotero-plugin/install-diagnostics.js";

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

const diagnostics = await collectInstallDiagnostics({
  repoRoot: process.cwd(),
  profileDir,
  appPath,
});

console.log(JSON.stringify(diagnostics, null, 2));
