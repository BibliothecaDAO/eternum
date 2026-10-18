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
  [...icons.map(({ id }) => `faceted/${id}`), "official/lords"].map((key) => [
    key,
    { verdict: "equal", reason: "Validation fixture" },
  ]),
);
const valid = () => structuredClone({ icons, meanings, resources, verdicts });
test("every semantic meaning and all 58 resources have reviewed artwork", () =>
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
test("realm levels reject the former shared castle and shared minimap emblem", () => {
  for (const [name, art] of [
    ["realm-2", "realm"],
    ["map-realm-3", "map-realm"],
  ]) {
    const input = valid();
    input.meanings[name].art = art;
    assert.throws(() => validateIcons(input), new RegExp(`${name} must use its own level painting`));
  }
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

test("LORDS rejects the former painted coin even when it has a passing review", () => {
  const input = valid();
  input.meanings.lords = { art: "lords", label: "LORDS", family: "Resources" };
  input.icons.push({ id: "lords" });
  input.verdicts["faceted/lords"] = { verdict: "equal", reason: "Old review" };
  assert.throws(() => validateIcons(input), /LORDS must use the unmodified official token mark/);
});
test("LORDS rejects a rotated mark, a redirected resource and a leftover painting", () => {
  const rotated = valid();
  rotated.meanings.lords.rotation = 90;
  assert.throws(() => validateIcons(rotated), /unmodified official token mark/);
  const redirected = valid();
  redirected.resources[37].meaning = "gold";
  assert.throws(() => validateIcons(redirected), /Resource 37 must use the LORDS token meaning/);
  const leftover = valid();
  leftover.icons.push({ id: "lords" });
  assert.throws(() => validateIcons(leftover), /Remove the painted LORDS asset/);
});

test("reward tiers reject the map-crate mapping and another band's artwork", () => {
  for (const name of Object.keys(meanings).filter((name) => name.startsWith("reward-chest"))) {
    const input = valid();
    input.meanings[name] = { art: "chest", label: "Chest", family: "Rewards" };
    assert.throws(() => validateIcons(input), /must use its approved reward tier/);
  }
  const wrongBand = valid();
  wrongBand.meanings["reward-chest-0"].rewardChest = "band-4-sealed";
  assert.throws(() => validateIcons(wrongBand), /must use its approved reward tier/);
});
