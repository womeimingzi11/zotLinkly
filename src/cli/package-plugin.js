import { packagePlugin } from "../zotero-plugin/package-plugin.js";

const plan = await packagePlugin();
console.log(plan.outputPath);
