import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { readPluginManifest, resolvePluginRoot } from "./dev-install.js";

const execFileAsync = promisify(execFile);

export function buildPackagePlan({
  repoRoot = process.cwd(),
  outputDir = path.join(repoRoot, "dist"),
  manifest = null,
  env = process.env,
} = {}) {
  const pluginRoot = resolvePluginRoot(repoRoot);
  const pluginManifest = manifest || readPluginManifest(pluginRoot).manifest;
  const pluginId = pluginManifest?.applications?.zotero?.id;
  const version = pluginManifest?.version;

  if (!pluginId) {
    throw new Error("Missing Zotero plugin id in manifest");
  }
  if (!version) {
    throw new Error("Missing plugin version in manifest");
  }

  const repoSlug =
    env.ZOTLINKLY_GITHUB_REPOSITORY ||
    env.GITHUB_REPOSITORY ||
    "chenhan/zotLinkly";
  const releaseTag =
    env.ZOTLINKLY_ZOTERO_RELEASE_TAG ||
    env.ZOTLINKLY_RELEASE_TAG ||
    `v${version}`;
  const updatesUrl = `https://github.com/${repoSlug}/releases/latest/download/updates.json`;
  const updateLink = `https://github.com/${repoSlug}/releases/download/${releaseTag}/${pluginId}.xpi`;
  const strictMinVersion = pluginManifest?.applications?.zotero?.strict_min_version;
  const strictMaxVersion = pluginManifest?.applications?.zotero?.strict_max_version;

  return {
    pluginRoot,
    pluginId,
    version,
    outputDir,
    repoSlug,
    releaseTag,
    updatesUrl,
    updateLink,
    strictMinVersion,
    strictMaxVersion,
    outputPath: path.join(outputDir, `${pluginId}.xpi`),
    updatesPath: path.join(outputDir, "updates.json"),
    releaseMetadataPath: path.join(outputDir, "release-metadata.json"),
    expectedEntries: [
      "bootstrap.js",
      "manifest.json",
      "prefs.js",
      "content/scripts/zotlinkly-zotero-plugin.js",
    ],
  };
}

export function validateManifest(manifest) {
  const zotero = manifest?.applications?.zotero;

  if (manifest?.manifest_version !== 2) {
    throw new Error("Zotero plugin manifest must use manifest_version 2");
  }
  if (!zotero?.id) {
    throw new Error("Zotero plugin manifest is missing applications.zotero.id");
  }
  if (!zotero?.update_url) {
    throw new Error("Zotero plugin manifest is missing applications.zotero.update_url");
  }
  if (!manifest?.author) {
    throw new Error("Zotero plugin manifest is missing author");
  }
  if (zotero?.strict_min_version !== "6.999") {
    throw new Error("Zotero plugin strict_min_version must stay at 6.999");
  }
  if (zotero?.strict_max_version !== "8.0.*") {
    throw new Error("Zotero plugin strict_max_version must stay at 8.0.*");
  }
}

export function buildUpdatesPayload(plan, { sha256 = null } = {}) {
  const payload = {
    addons: {
      [plan.pluginId]: {
        updates: [
          {
            version: plan.version,
            update_link: plan.updateLink,
            applications: {
              zotero: {
                strict_min_version: plan.strictMinVersion,
                strict_max_version: plan.strictMaxVersion,
              },
            },
          },
        ],
      },
    },
  };

  if (sha256) {
    payload.addons[plan.pluginId].updates[0].sha256 = sha256;
  }

  return payload;
}

function computeSha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

async function listZipEntries(filePath) {
  const { stdout } = await execFileAsync("python3", [
    "-c",
    [
      "import pathlib, sys, zipfile",
      "archive = pathlib.Path(sys.argv[1])",
      "with zipfile.ZipFile(archive) as zf:\n    print('\\n'.join(zf.namelist()))",
    ].join("\n"),
    filePath,
  ]);
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function readZipEntry(filePath, entryPath) {
  const { stdout } = await execFileAsync("python3", [
    "-c",
    [
      "import pathlib, sys, zipfile",
      "archive = pathlib.Path(sys.argv[1])",
      "entry = sys.argv[2]",
      "with zipfile.ZipFile(archive) as zf:\n    print(zf.read(entry).decode('utf-8'), end='')",
    ].join("\n"),
    filePath,
    entryPath,
  ]);
  return stdout;
}

export async function packagePlugin(options = {}) {
  const plan = buildPackagePlan(options);
  validateManifest(
    options.manifest || readPluginManifest(plan.pluginRoot).manifest,
  );

  fs.mkdirSync(plan.outputDir, { recursive: true });
  fs.rmSync(plan.outputPath, { force: true });
  fs.rmSync(plan.updatesPath, { force: true });
  fs.rmSync(plan.releaseMetadataPath, { force: true });

  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zotlinkly-plugin-"));
  const stagingPluginRoot = path.join(stagingRoot, "addon");
  fs.cpSync(plan.pluginRoot, stagingPluginRoot, { recursive: true });

  const stagedManifestPath = path.join(stagingPluginRoot, "manifest.json");
  const stagedManifest = JSON.parse(fs.readFileSync(stagedManifestPath, "utf8"));
  stagedManifest.applications.zotero.update_url = plan.updatesUrl;
  fs.writeFileSync(stagedManifestPath, `${JSON.stringify(stagedManifest, null, 2)}\n`);

  try {
    await execFileAsync(
      "zip",
      ["-q", "-r", plan.outputPath, "."],
      { cwd: stagingPluginRoot },
    );
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }

  const sha256 = computeSha256(plan.outputPath);
  const updatesPayload = buildUpdatesPayload(plan, { sha256 });
  fs.writeFileSync(plan.updatesPath, `${JSON.stringify(updatesPayload, null, 2)}\n`);
  fs.writeFileSync(
    plan.releaseMetadataPath,
    `${JSON.stringify(
      {
        pluginId: plan.pluginId,
        version: plan.version,
        repoSlug: plan.repoSlug,
        releaseTag: plan.releaseTag,
        outputPath: plan.outputPath,
        updatesPath: plan.updatesPath,
        releaseMetadataPath: plan.releaseMetadataPath,
        updateUrl: plan.updatesUrl,
        updateLink: plan.updateLink,
        sha256,
      },
      null,
      2,
    )}\n`,
  );

  return {
    ...plan,
    sha256,
  };
}

export async function validatePackagedPlugin(options = {}) {
  const plan = buildPackagePlan(options);
  const sourceManifest = options.manifest || readPluginManifest(plan.pluginRoot).manifest;
  validateManifest(sourceManifest);

  if (!fs.existsSync(plan.outputPath)) {
    throw new Error(`Missing packaged plugin: ${plan.outputPath}`);
  }
  if (!fs.existsSync(plan.updatesPath)) {
    throw new Error(`Missing updates.json: ${plan.updatesPath}`);
  }
  if (!fs.existsSync(plan.releaseMetadataPath)) {
    throw new Error(`Missing release-metadata.json: ${plan.releaseMetadataPath}`);
  }

  const zipEntries = await listZipEntries(plan.outputPath);
  for (const entry of plan.expectedEntries) {
    if (!zipEntries.includes(entry)) {
      throw new Error(`Packaged plugin is missing required entry: ${entry}`);
    }
  }

  const packagedManifest = JSON.parse(await readZipEntry(plan.outputPath, "manifest.json"));
  validateManifest(packagedManifest);
  if (packagedManifest.applications.zotero.update_url !== plan.updatesUrl) {
    throw new Error("Packaged plugin manifest update_url does not match release plan");
  }

  const updatesPayload = JSON.parse(fs.readFileSync(plan.updatesPath, "utf8"));
  const updateRecord = updatesPayload?.addons?.[plan.pluginId]?.updates?.[0];
  if (!updateRecord) {
    throw new Error("updates.json is missing the ZotLinkly update record");
  }
  if (updateRecord.version !== plan.version) {
    throw new Error("updates.json version does not match plugin version");
  }
  if (updateRecord.update_link !== plan.updateLink) {
    throw new Error("updates.json update_link does not match release plan");
  }
  if (updateRecord?.applications?.zotero?.strict_max_version !== plan.strictMaxVersion) {
    throw new Error("updates.json strict_max_version does not match plugin manifest");
  }

  const releaseMetadata = JSON.parse(fs.readFileSync(plan.releaseMetadataPath, "utf8"));
  const sha256 = computeSha256(plan.outputPath);
  if (releaseMetadata.sha256 !== sha256) {
    throw new Error("release-metadata.json sha256 does not match the packaged plugin");
  }

  return {
    ...plan,
    sha256,
    zipEntries,
  };
}
