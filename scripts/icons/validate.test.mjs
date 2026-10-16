import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateIcons } from "./validate.mjs";
const source = new URL("../../apps/game/asset-sources/facets/", import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(`${name}.json`, source), "utf8"));
const { icons } = read("catalog");
const meanings = read("semantic-map");
const resources = read("resources");
const verdicts = Object.fromEntries(
  icons.map(({ id }) => [`faceted/${id}`, { verdict: "equal", reason: "Validation fixture" }]),
);
const valid = () => structuredClone({ icons, meanings, resources, verdicts });
test("every semantic meaning and all 58 resources have a painting", () =>
  assert.doesNotThrow(() => validateIcons(valid())));
for (const [meaning, wrongArt, expected] of [
  ["transfer", "move", "donkey"],
  ["production", "settings", "production"],
]) {
  test(`${meaning} rejects the previously reused ${wrongArt} painting`, () => {
    const input = valid();
    input.meanings[meaning].art = wrongArt;
    assert.throws(() => validateIcons(input), new RegExp(`${meaning} must use ${expected}`));
  });
}
test("missing paintings fail validation", () => {
  const input = valid();
  input.icons = input.icons.filter(({ id }) => id !== "production");
  assert.throws(() => validateIcons(input), /Missing painting for production/);
});
test("missing resource meanings fail validation", () => {
  const input = valid();
  delete input.resources[58];
  assert.throws(() => validateIcons(input), /Missing resource meaning: 58/);
});
for (const verdict of [undefined, "worse"])
  test(`unreviewed or worse art cannot ship: ${verdict}`, () => {
    const input = valid();
    input.verdicts["faceted/production"] = { verdict, reason: "Review rejected" };
    assert.throws(() => validateIcons(input), /Review production/);
  });
