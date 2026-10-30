import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateTroopPackage } from "./validate-troop-package.mjs";

const root = new URL("../assets/troop-packages/", import.meta.url);
const example = (family) => JSON.parse(readFileSync(new URL(`${family}.example.json`, root), "utf8"));
const rejected = (pkg, message) => {
  const result = validateTroopPackage(pkg);
  assert.equal(result.ok, false);
  assert.equal(result.scope, "metadata-only");
  assert.equal(result.physicalFit, "not-evaluated");
  assert.match(result.errors.join("; "), message);
};

test("synthetic examples accept every supported formation count without approving physical fit", () => {
  for (const [family, maximum] of [
    ["knight", 6],
    ["crossbowman", 6],
    ["paladin", 3],
  ]) {
    for (let count = 1; count <= maximum; count++) {
      const pkg = example(family);
      pkg.count = count;
      assert.deepEqual(validateTroopPackage(pkg), {
        ok: true,
        scope: "metadata-only",
        physicalFit: "not-evaluated",
        errors: [],
      });
    }
  }
});

test("rejects inherited object keys and malformed metadata without throwing", () => {
  for (const family of ["toString", "__proto__", "constructor", null, {}]) {
    const pkg = example("knight");
    pkg.family = family;
    rejected(pkg, /family must be knight, crossbowman or paladin/);
  }
  for (const malformed of [
    null,
    [],
    {},
    { ...example("knight"), items: null },
    { ...example("knight"), skin: null },
    { ...example("knight"), controller: null },
  ]) {
    assert.equal(validateTroopPackage(malformed).ok, false);
  }
  const inherited = Object.create({ skin: example("knight").skin });
  Object.assign(inherited, example("knight"));
  delete inherited.skin;
  rejected(inherited, /skin is required/);
});

test("accepts declared future actions and named item motion classes", () => {
  const pkg = example("crossbowman");
  pkg.controller.supportedActions.push("reload");
  pkg.requestedActions.push("reload");
  pkg.items.primary.motionClass = "crossbow-aim-and-release";
  pkg.controller.supportedMotionClasses.push("crossbow-aim-and-release");
  pkg.controller.supportedMotionClasses = pkg.controller.supportedMotionClasses.filter((value) => value !== "ranged");
  assert.equal(validateTroopPackage(pkg).ok, true);
  pkg.items.primary.motionClass = "";
  rejected(pkg, /items.primary.motionClass must be a nonempty string/);
});

test("does not require a weapon bolt landmark on the humanoid skin", () => {
  const pkg = example("crossbowman");
  assert.equal(pkg.skin.capabilities.includes("boltAxis"), false);
  assert.equal(validateTroopPackage(pkg).ok, true);
});

test("rejects a wrong-family sword", () => {
  const pkg = example("knight");
  pkg.items.primary.family = "paladin";
  rejected(pkg, /items.primary family mismatch/);
});

test("rejects a weapon in the secondary slot", () => {
  const pkg = example("knight");
  pkg.items.secondary = { ...pkg.items.primary, id: "wrong-slot-example" };
  rejected(pkg, /items.secondary requires role shield/);
});

test("rejects missing semantic capabilities and omitted item requirements", () => {
  const pkg = example("crossbowman");
  pkg.skin.capabilities = pkg.skin.capabilities.filter((cap) => cap !== "supportGripLeft");
  rejected(pkg, /skin lacks supportGripLeft/);
  const omitted = example("paladin");
  omitted.items.secondary.requiredCapabilities = [];
  rejected(omitted, /must require forearmShieldLeft/);
  const mounted = example("paladin");
  mounted.skin.capabilities = mounted.skin.capabilities.filter((cap) => cap !== "reinGripLeft");
  rejected(mounted, /skin lacks reinGripLeft/);
});

test("rejects a controller with an incompatible rig contract or motion class", () => {
  const pkg = example("paladin");
  pkg.controller.rigContract = "other-mounted-rig";
  rejected(pkg, /controller rigContract mismatch/);
  const motion = example("knight");
  motion.controller.supportedMotionClasses = ["melee"];
  rejected(motion, /controller does not support guard motion/);
});

test("rejects actions not supported by the controller", () => {
  const pkg = example("crossbowman");
  pkg.requestedActions.push("defend");
  rejected(pkg, /unsupported requested action: defend/);
});

test("rejects out-of-range and fractional counts", () => {
  for (const [family, count] of [
    ["knight", 0],
    ["knight", 7],
    ["crossbowman", 2.5],
    ["paladin", 4],
  ]) {
    const pkg = example(family);
    pkg.count = count;
    rejected(pkg, /count must be an integer/);
  }
});

test("rejects independent armor slots and non-integrated armor", () => {
  const pkg = example("knight");
  pkg.items.armor = { id: "separate-plate" };
  rejected(pkg, /items.armor is not allowed/);
  const separate = example("knight");
  separate.skin.armorMode = "separate";
  rejected(separate, /armorMode must be integrated/);
});
