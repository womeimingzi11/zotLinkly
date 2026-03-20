import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildPackagePlan } from "../src/zotero-plugin/package-plugin.js";

test("buildPackagePlan derives xpi output path from manifest id", () => {
  const plan = buildPackagePlan({
    repoRoot: "/workspace/repo",
    outputDir: "/workspace/repo/dist",
    manifest: {
      applications: {
        zotero: {
          id: "zotlinkly@local",
        },
      },
    },
  });

  assert.equal(
    plan.pluginRoot,
    path.join("/workspace/repo", "plugins", "zotlinkly-zotero-plugin", "addon"),
  );
  assert.equal(plan.pluginId, "zotlinkly@local");
  assert.equal(plan.outputPath, path.join("/workspace/repo/dist", "zotlinkly@local.xpi"));
});
