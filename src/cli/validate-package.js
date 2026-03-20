import { packagePlugin, validatePackagedPlugin } from "../zotero-plugin/package-plugin.js";

const packaged = await packagePlugin();
const validated = await validatePackagedPlugin();

console.log(
  JSON.stringify(
    {
      outputPath: packaged.outputPath,
      updatesPath: packaged.updatesPath,
      releaseMetadataPath: packaged.releaseMetadataPath,
      updateUrl: packaged.updatesUrl,
      updateLink: packaged.updateLink,
      sha256: validated.sha256,
      zipEntries: validated.zipEntries,
    },
    null,
    2,
  ),
);
