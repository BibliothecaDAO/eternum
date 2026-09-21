import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildLayout, corners, disk, distance, halo, key, neighbors, RULES, scale } from "./geometry.mjs";

const layout = buildLayout();
const mountainKeys = new Set(layout.mountains.map(key));
const primaryExploration = new Set(layout.primaryPreexplored.map(key));
const etherealExploration = new Set(layout.etherealPreexplored.map(key));
const etherealSpireKeys = new Set(layout.etherealSpires.map(key));
const claims = [];
function check(name, verify) {
  verify();
  claims.push({ claim: name, result: "PASS" });
}

check("The reference reproduces 6 banks on Realm ring21 and 61 spacing-six spires including the origin.", () => {
  assert.equal(layout.previousBanks.length, 6);
  assert(layout.previousBanks.every((point) => distance(point) === 21));
  assert.equal(layout.previousSpires.length, 61);
  assert(layout.previousSpires.some((point) => distance(point) === 0));
});
check("The proposal has 96 unique paired spires: 6/6/12/18/24/30 on radii 2/6/12/18/24/30.", () => {
  assert.equal(etherealSpireKeys.size, 96);
  assert.deepEqual(
    [2, 6, 12, 18, 24, 30].map((radius) => layout.etherealSpires.filter((point) => distance(point) === radius).length),
    [6, 6, 12, 18, 24, 30],
  );
  assert(!etherealSpireKeys.has("0,0"));
  assert.deepEqual(
    layout.primarySpires,
    layout.etherealSpires.map((point) => scale(point, 15)),
  );
});
check("Mountain rings32–35 contain exactly 804 cells; every one is pre-explored.", () => {
  assert.equal(mountainKeys.size, 804);
  assert.equal(layout.mountains.length, mountainKeys.size);
  for (const point of disk(45))
    assert.equal(mountainKeys.has(key(point)), distance(point) >= 32 && distance(point) <= 35);
  for (const mountain of mountainKeys) assert(primaryExploration.has(mountain));
});
check("Graph flood-fill cannot cross the mountain barrier: the origin component is exactly rings0–31.", () => {
  const visited = new Set(["0,0"]);
  const queue = [[0, 0]];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const next of neighbors(queue[cursor])) {
      if (distance(next) > 45 || mountainKeys.has(key(next)) || visited.has(key(next))) continue;
      visited.add(key(next));
      queue.push(next);
    }
  }
  assert.equal(visited.size, 2977);
  assert.deepEqual(visited, new Set(disk(31).map(key)));
  for (const point of corners(45)) assert(!visited.has(key(point)));
});
check(
  "All six inner spires and their full halos lie inside the mountain barrier; each is 30 steps from the bank.",
  () => {
    const innerSpires = layout.primarySpires.filter((point) => distance(point) === 30);
    assert.equal(innerSpires.length, 6);
    for (const point of halo(innerSpires)) {
      assert(distance(point) <= 31);
      assert(primaryExploration.has(key(point)));
      assert(!mountainKeys.has(key(point)));
    }
    for (const [q, r] of innerSpires) {
      const route = Array.from({ length: 31 }, (_, i) => [(q * i) / 30, (r * i) / 30]);
      assert(route.every((point) => point.every(Number.isInteger) && !mountainKeys.has(key(point))));
      assert.equal(route.length - 1, 30);
    }
  },
);
check(
  "All structure neighbors are revealed; ethereal origin is reserved and pre-explored; outer halos are retained.",
  () => {
    assert.equal(primaryExploration.size, 1483);
    assert.equal(etherealExploration.size, 667);
    for (const point of halo([[0, 0], ...layout.primarySpires])) assert(primaryExploration.has(key(point)));
    for (const point of halo(layout.etherealSpires)) assert(etherealExploration.has(key(point)));
    assert(etherealExploration.has("0,0"));
    assert(!etherealSpireKeys.has("0,0"));
    assert(layout.etherealPreexplored.some((point) => distance(point) === 31));
  },
);
check("Realm ring3 starts at primary ring45, outside the excluded foundation area and the mountains.", () => {
  const firstSites = disk(3)
    .filter((point) => distance(point) === 3)
    .map((point) => scale(point, 15));
  assert.equal(firstSites.length, 18);
  assert(firstSites.every((point) => distance(point) === 45 && !mountainKeys.has(key(point))));
});

check("Ethereal discovery core keeps radius24 with 403 explored and 1398 eligible unexplored hexes.", () => {
  assert.equal(layout.etherealPreexplored.filter((point) => distance(point) <= 24).length, 403);
  assert.equal(disk(24).length - layout.etherealPreexplored.filter((point) => distance(point) <= 24).length, 1398);
});

const metadata = JSON.parse(await readFile(new URL("metadata.json", import.meta.url), "utf8"));
assert.equal(metadata.counts.spirePairs, layout.etherealSpires.length);
assert.equal(metadata.counts.primaryPreexplored, layout.primaryPreexplored.length);
for (const file of metadata.files) {
  const svg = await readFile(new URL(file, import.meta.url), "utf8");
  assert(svg.includes('<title id="title">') && svg.includes('<desc id="desc">'));
  assert(!svg.match(/\b(?:NaN|Infinity|undefined)\b/));
  assert(svg.endsWith("</svg>\n"));
}
console.log(
  JSON.stringify(
    {
      result: "PASS",
      checks: claims.length,
      claims,
      scope: "Design-map geometry and exploration rules; not gameplay runtime evidence.",
    },
    null,
    2,
  ),
);
