import { createHash } from "node:crypto";

export function hashContent(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}
