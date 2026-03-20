import test from "node:test";
import assert from "node:assert/strict";

import { matchesQuery } from "../src/utils/text.js";

test("matchesQuery handles multi-word queries term by term", () => {
  const item = {
    title: "Spatial ecology of nematodes",
    abstractNote: "A review of large-scale distribution patterns.",
    creators: [{ firstName: "Ting", lastName: "Liu" }],
    tags: [{ tag: "soil ecology" }],
    collections: [{ key: "COL1", name: "Review Set" }],
  };

  assert.equal(matchesQuery(item, "soil nematode"), true);
  assert.equal(matchesQuery(item, "soil tourism"), false);
});
