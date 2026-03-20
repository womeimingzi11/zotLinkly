import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { readPluginManifest, resolvePluginRoot } from "./dev-install.js";

const execFileAsync = promisify(execFile);

export function buildPackagePlan({
  repoRoot = process.cwd(),
  outputDir = path.join(repoRoot, "dist"),
  manifest = null,
} = {}) {
  const pluginRoot = resolvePluginRoot(repoRoot);
  const pluginManifest = manifest || readPluginManifest(pluginRoot).manifest;
  const pluginId = pluginManifest?.applications?.zotero?.id;

  if (!pluginId) {
    throw new Error("Missing Zotero plugin id in manifest");
  }

  return {
    pluginRoot,
    pluginId,
    outputDir,
    outputPath: path.join(outputDir, `${pluginId}.xpi`),
  };
}

export async function packagePlugin(options = {}) {
  const plan = buildPackagePlan(options);
  fs.mkdirSync(plan.outputDir, { recursive: true });
  fs.rmSync(plan.outputPath, { force: true });

  await execFileAsync(
    "zip",
    ["-q", "-r", plan.outputPath, "."],
    { cwd: plan.pluginRoot },
  );

  return plan;
}
