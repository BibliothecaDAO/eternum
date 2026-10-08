import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const FAMILIES = {
  knight: {
    count: [1, 6],
    capabilities: ["gripRight", "forearmShieldLeft"],
    items: { primary: ["weapon", ["gripRight"]], secondary: ["shield", ["forearmShieldLeft"]] },
  },
  crossbowman: {
    count: [1, 6],
    capabilities: ["gripRight", "supportGripLeft", "lowerBackQuiver"],
    items: { primary: ["crossbow", ["gripRight", "supportGripLeft"]], secondary: ["quiver", ["lowerBackQuiver"]] },
  },
  paladin: {
    count: [1, 3],
    capabilities: ["gripRight", "forearmShieldLeft", "seat", "reinGripLeft", "stirrupLeft", "stirrupRight"],
    items: { primary: ["weapon", ["gripRight"]], secondary: ["shield", ["forearmShieldLeft"]] },
  },
};

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function stringSet(value) {
  return Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length;
}
function checkKeys(value, expected, label, fail) {
  if (!record(value)) {
    fail(`${label} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) if (!expected.includes(key)) fail(`${label}.${key} is not allowed`);
  for (const key of expected) if (!Object.hasOwn(value, key)) fail(`${label}.${key} is required`);
  return true;
}

function checkSkin(pkg, policy, fail) {
  const skin = pkg.skin;
  if (!checkKeys(skin, ["id", "family", "rigContract", "armorMode", "capabilities"], "skin", fail)) return;
  if (!nonempty(skin.id) || !nonempty(skin.rigContract)) fail("skin needs id and rigContract");
  if (skin.family !== pkg.family) fail("skin family mismatch");
  if (skin.armorMode !== "integrated") fail("armorMode must be integrated");
  if (!stringSet(skin.capabilities)) {
    fail("skin capabilities must be unique strings");
    return;
  }
  for (const cap of policy?.capabilities ?? []) if (!skin.capabilities.includes(cap)) fail(`skin lacks ${cap}`);
}

function checkController(pkg, fail) {
  const controller = pkg.controller;
  if (
    !checkKeys(
      controller,
      ["id", "family", "rigContract", "supportedActions", "supportedMotionClasses"],
      "controller",
      fail,
    )
  )
    return;
  if (!nonempty(controller.id) || !nonempty(controller.rigContract)) fail("controller needs id and rigContract");
  if (controller.family !== pkg.family) fail("controller family mismatch");
  if (controller.rigContract !== pkg.skin?.rigContract) fail("controller rigContract mismatch");
  if (!stringSet(controller.supportedActions)) fail("controller supportedActions must be unique nonempty strings");
  else if (Array.isArray(pkg.requestedActions))
    for (const action of pkg.requestedActions) {
      if (!controller.supportedActions.includes(action)) fail(`unsupported requested action: ${action}`);
    }
  if (!stringSet(controller.supportedMotionClasses)) fail("controller supportedMotionClasses must be unique strings");
}

function checkItem(pkg, policy, slot, fail) {
  const item = pkg.items[slot];
  if (!checkKeys(item, ["id", "family", "role", "requiredCapabilities", "motionClass"], `items.${slot}`, fail)) return;
  if (!nonempty(item.id)) fail(`items.${slot}.id is required`);
  if (item.family !== pkg.family) fail(`items.${slot} family mismatch`);
  const expected = policy?.items[slot];
  if (expected && item.role !== expected[0]) fail(`items.${slot} requires role ${expected[0]}`);
  if (!nonempty(item.motionClass)) fail(`items.${slot}.motionClass must be a nonempty string`);
  if (!stringSet(item.requiredCapabilities)) fail(`items.${slot}.requiredCapabilities must be unique strings`);
  else {
    for (const cap of expected?.[1] ?? [])
      if (!item.requiredCapabilities.includes(cap)) {
        fail(`items.${slot} must require ${cap}`);
      }
    for (const cap of item.requiredCapabilities)
      if (!Array.isArray(pkg.skin?.capabilities) || !pkg.skin.capabilities.includes(cap)) {
        fail(`items.${slot} requires missing capability ${cap}`);
      }
  }
  if (
    nonempty(item.motionClass) &&
    (!Array.isArray(pkg.controller?.supportedMotionClasses) ||
      !pkg.controller.supportedMotionClasses.includes(item.motionClass))
  ) {
    fail(`controller does not support ${item.motionClass} motion`);
  }
}

function checkItems(pkg, policy, fail) {
  if (!checkKeys(pkg.items, ["primary", "secondary"], "items", fail)) return;
  for (const slot of ["primary", "secondary"]) checkItem(pkg, policy, slot, fail);
}

export function validateTroopPackage(pkg) {
  const errors = [];
  const fail = (message) => errors.push(message);
  const result = () => ({ ok: errors.length === 0, scope: "metadata-only", physicalFit: "not-evaluated", errors });
  if (
    !checkKeys(
      pkg,
      ["schemaVersion", "family", "count", "requestedActions", "skin", "controller", "items"],
      "package",
      fail,
    )
  )
    return result();
  if (pkg.schemaVersion !== 1) fail("schemaVersion must be 1");
  const policy =
    typeof pkg.family === "string" && Object.hasOwn(FAMILIES, pkg.family) ? FAMILIES[pkg.family] : undefined;
  if (!policy) fail("family must be knight, crossbowman or paladin");
  if (!Number.isInteger(pkg.count) || (policy && (pkg.count < policy.count[0] || pkg.count > policy.count[1]))) {
    fail(`count must be an integer in ${policy ? policy.count.join("..") : "the family range"}`);
  }
  if (!stringSet(pkg.requestedActions)) fail("requestedActions must be unique nonempty strings");
  checkSkin(pkg, policy, fail);
  checkController(pkg, fail);
  checkItems(pkg, policy, fail);
  return result();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node validate-troop-package.mjs package.json");
    const result = validateTroopPackage(JSON.parse(readFileSync(process.argv[2], "utf8")));
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
