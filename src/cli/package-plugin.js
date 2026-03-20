import { packagePlugin } from "../zotero-plugin/package-plugin.js";

const plan = await packagePlugin();
console.log(
  JSON.stringify(
    {
      outputPath: plan.outputPath,
      updatesPath: plan.updatesPath,
      releaseMetadataPath: plan.releaseMetadataPath,
      updateUrl: plan.updatesUrl,
      updateLink: plan.updateLink,
      sha256: plan.sha256,
      releaseTag: plan.releaseTag,
      repoSlug: plan.repoSlug,
    },
    null,
    2,
  ),
);
