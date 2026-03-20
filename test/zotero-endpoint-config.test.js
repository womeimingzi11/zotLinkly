import test from "node:test";
import assert from "node:assert/strict";

import { getConfig } from "../src/config.js";

test("default zotero endpoint uses a non-conflicting bridge port", () => {
  const original = process.env.ZOTLINKLY_ZOTERO_ENDPOINT;
  delete process.env.ZOTLINKLY_ZOTERO_ENDPOINT;

  try {
    const config = getConfig();
    assert.equal(config.zoteroEndpoint, "http://127.0.0.1:23121");
  } finally {
    if (original !== undefined) {
      process.env.ZOTLINKLY_ZOTERO_ENDPOINT = original;
    }
  }
});
