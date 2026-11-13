import assert from "node:assert/strict";
import test from "node:test";
import { assignWireIds, validateWireIds, wireIds } from "./wire-ids.mjs";

test("deletion leaves the original command and story IDs in place", () => {
  const commands = assignWireIds(
    "commands",
    wireIds.commands.filter(({ retired }) => !retired),
  );
  const stories = assignWireIds(
    "stories",
    wireIds.stories.filter(({ retired }) => !retired),
  );
  assert.equal(commands.find(({ name }) => name === "LevelUp").wireId, 6);
  assert.equal(commands.find(({ name }) => name === "InteractSite").wireId, 69);
  assert.equal(stories.find(({ name }) => name === "StructureLevelUpStory").wireId, 1);
  assert.equal(stories.find(({ name }) => name === "SiteUsed").wireId, 36);
});

test("the renumbering caused by removing retired entries is rejected", () => {
  const renumbered = Object.fromEntries(
    Object.entries(wireIds).map(([kind, entries]) => [
      kind,
      entries.filter(({ retired }) => !retired).map((entry, id) => ({ ...entry, id })),
    ]),
  );
  assert.throws(() => validateWireIds(renumbered, wireIds), /changed or reused/);
});

test("allocated IDs cannot be renamed, dropped, or reactivated", () => {
  for (const kind of ["commands", "stories"]) {
    const reused = structuredClone(wireIds);
    reused[kind].find(({ retired }) => retired).name = "Replacement";
    assert.throws(() => validateWireIds(reused, wireIds), /changed or reused/);
    const reactivated = structuredClone(wireIds);
    reactivated[kind].find(({ retired }) => retired).retired = false;
    assert.throws(() => validateWireIds(reactivated, wireIds), /changed or reused/);
    const truncated = structuredClone(wireIds);
    truncated[kind].pop();
    assert.throws(() => validateWireIds(truncated, wireIds), /changed or reused/);
  }
});

test("a new allocation appends after all live and retired IDs", () => {
  const next = structuredClone(wireIds);
  next.commands.push({ id: next.commands.length, name: "NewCommand", retired: false });
  assert.doesNotThrow(() => validateWireIds(next, wireIds));
  next.commands.at(-1).id = 5;
  assert.throws(() => validateWireIds(next, wireIds), /Invalid commands wire allocation/);
});

test("a retired name cannot become a live route", () => {
  const live = wireIds.commands.filter(({ retired }) => !retired);
  live[0] = wireIds.commands.find(({ retired }) => retired);
  assert.throws(() => assignWireIds("commands", live), /Allocate a permanent commands wire ID/);
});
