import test from "node:test";
import assert from "node:assert/strict";

import { buildSearchQueries, matchesQuery } from "../src/utils/text.js";

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

test("buildSearchQueries expands recall queries more aggressively than fast queries", () => {
  const fast = buildSearchQueries("global soil nematode community", { mode: "fast" });
  const recall = buildSearchQueries("global soil nematode community", { mode: "recall" });

  assert.deepEqual(fast[0], "global soil nematode community");
  assert.equal(recall.length > fast.length, true);
  assert.equal(recall.includes("\"global soil nematode community\""), true);
  assert.equal(recall.includes("soil nematode"), true);
});
