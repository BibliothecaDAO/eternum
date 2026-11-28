import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const TUNABLE = /_(BPS|PERCENT|STAMINA|PER_TICK|PER_RANK|PER_FRAGMENT|FRAGMENTS|LIMIT|CAP|SHARE|BASE|STEPS|STORES)$/;

export function identifierConstants(balance) {
  return Object.fromEntries(
    Object.entries(balance)
      .map(([group, constants]) => [
        group.replace(/^native(\w)(\w*)Constants$/, (_match, first, rest) => first.toLowerCase() + rest),
        Object.fromEntries(Object.entries(constants).filter(([name]) => !TUNABLE.test(name))),
      ])
      .filter(([, constants]) => Object.keys(constants).length > 0),
  );
}

export function balanceIdentity(balance) {
  const numbers = Object.entries(balance)
    .flatMap(([, constants]) => Object.entries(constants).filter(([name]) => TUNABLE.test(name)))
    .map(([, value]) => value);
  return createHash("sha256").update(JSON.stringify(numbers)).digest("hex");
}

export async function readBalanceConstants(root) {
  return {
    nativeRuleConstants: await readRuleConstants(root),
    nativeQuestConstants: await readQuestConstants(root),
    nativeBaneConstants: await readBaneConstants(root),
    nativeRaceConstants: await readRaceConstants(root),
    nativeArrivalConstants: await readArrivalConstants(root),
    nativeOathConstants: await readOathConstants(root),
    nativeResearchConstants: await readResearchConstants(root),
    nativeFragmentConstants: await readFragmentConstants(root),
    nativeFamilyConstants: await readFamilyConstants(root),
    nativeStructureConstants: await readStructureConstants(root),
    nativeRealmSkinConstants: await readRealmSkinConstants(root),
  };
}

export async function readRuleConstants(root) {
  const [source, days] = await Promise.all([
    readFile(new URL("src/rules.cairo", root), "utf8"),
    readFile(new URL("src/day_schedule.cairo", root), "utf8"),
  ]);
  const shared = unsignedConstants(days);
  const resolved = source.replace(
    /^pub const ([A-Z][A-Z0-9_]*): u32 = crate::days::([A-Z][A-Z0-9_]*);$/gm,
    (_line, name, alias) => {
      if (!Object.hasOwn(shared, alias)) throw new Error(`Unknown shared rule constant ${alias}`);
      return `pub const ${name}: u32 = ${shared[alias]};`;
    },
  );
  return unsignedConstants(resolved);
}

function unsignedConstants(source, widths = "8|32") {
  return Object.fromEntries(
    [...source.matchAll(new RegExp(`^pub const ([A-Z][A-Z0-9_]*): u(?:${widths}) = ([0-9]+);$`, "gm"))].map(
      ([, name, value]) => [name, Number(value)],
    ),
  );
}

async function readQuestConstants(root) {
  return unsignedConstants(await readFile(new URL("src/quests.cairo", root), "utf8"));
}

export async function readStructureConstants(root) {
  return unsignedLists(await readFile(new URL("src/balance/structures.cairo", root), "utf8"));
}

export async function readDevconHolders(root) {
  const source = await readFile(new URL("src/devcon_holders.cairo", root), "utf8");
  const lists = Object.fromEntries(
    [...source.matchAll(/^pub const ([A-Z][A-Z0-9_]*): \[felt252; ([0-9]+)\] = \[([0-9a-fx,\s]*)\];$/gm)].map(
      ([, name, length, body]) => {
        const values = body
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (values.length !== Number(length))
          throw new Error(`${name} declares ${length} values and lists ${values.length}`);
        for (let index = 0; index < values.length; index++) {
          if (!/^0x[1-9a-f][0-9a-f]*$/.test(values[index]))
            throw new Error(`${name}[${index}] must be canonical lowercase hex`);
          if (index > 0 && BigInt(values[index]) <= BigInt(values[index - 1]))
            throw new Error(`${name} must be strictly sorted ascending`);
        }
        return [name, values];
      },
    ),
  );
  const golden = lists.GOLDEN_DEVCON_HOLDERS;
  const regular = lists.REGULAR_DEVCON_HOLDERS;
  if (!golden || !regular) throw new Error("Missing GOLDEN_DEVCON_HOLDERS or REGULAR_DEVCON_HOLDERS");
  const goldenSet = new Set(golden);
  for (const holder of regular) {
    if (goldenSet.has(holder)) throw new Error("Devcon golden and regular holder sets overlap");
  }
  return { GOLDEN_DEVCON_HOLDERS: golden, REGULAR_DEVCON_HOLDERS: regular };
}

function unsignedLists(source) {
  return Object.fromEntries(
    [...source.matchAll(/^pub const ([A-Z][A-Z0-9_]*): \[u(?:8|16|32); ([0-9]+)\] = \[([0-9,\s]*)\];$/gm)].map(
      ([, name, length, body]) => {
        const values = body
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .map(Number);
        if (values.length !== Number(length))
          throw new Error(`${name} declares ${length} values and lists ${values.length}`);
        return [name, values];
      },
    ),
  );
}

async function readResearchConstants(root) {
  return unsignedConstants(await readFile(new URL("src/research.cairo", root), "utf8"), "8");
}

async function readOathConstants(root) {
  return unsignedConstants(await readFile(new URL("src/oaths.cairo", root), "utf8"), "8|16");
}

async function readFamilyConstants(root) {
  return unsignedConstants(await readFile(new URL("src/game.cairo", root), "utf8"), "8");
}

async function readRealmSkinConstants(root) {
  return unsignedConstants(await readFile(new URL("src/names.cairo", root), "utf8"), "8");
}

async function readFragmentConstants(root) {
  return unsignedConstants(await readFile(new URL("src/fragments.cairo", root), "utf8"), "8|16");
}

async function readArrivalConstants(root) {
  const { SLOTS_PER_DAY } = unsignedConstants(await readFile(new URL("src/arrivals.cairo", root), "utf8"), "8");
  if (SLOTS_PER_DAY === undefined) throw new Error("Missing Cairo arrival slot count");
  return { SLOTS_PER_DAY };
}

export async function readLogicSlots(root) {
  const { FRONTIER_SLOTS, ...slots } = unsignedConstants(await readFile(new URL("src/slots.cairo", root), "utf8"), "8");
  const ordered = Object.entries(slots).sort(([, left], [, right]) => left - right);
  if (ordered.length !== FRONTIER_SLOTS || ordered.some(([, slot], index) => slot !== index))
    throw new Error("Cairo logic slots must number 0 to FRONTIER_SLOTS - 1");
  return ordered.map(([constant, slot]) => {
    const name = constant.toLowerCase();
    return { slot, name, contract: `${name[0].toUpperCase()}${name.slice(1)}Logic` };
  });
}

/** Release behavior is not part of the immutable fact wire schema. */
export async function readReleaseConstants(root) {
  return unsignedConstants(await readFile(new URL("src/logic/release.cairo", root), "utf8"));
}

async function readRaceConstants(root) {
  return unsignedConstants(await readFile(new URL("src/race.cairo", root), "utf8"));
}

async function readBaneConstants(root) {
  const source = await readFile(new URL("src/banes.cairo", root), "utf8");
  const quests = await readQuestConstants(root);
  const resolved = source.replace(
    /^pub const ([A-Z][A-Z0-9_]*): u8 = crate::quests::([A-Z][A-Z0-9_]*);$/gm,
    (_line, name, quest) => {
      if (!Object.hasOwn(quests, quest)) throw new Error(`Unknown bane quest ${quest}`);
      return `pub const ${name}: u8 = ${quests[quest]};`;
    },
  );
  return unsignedConstants(resolved);
}
