import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const TUNABLE = /_(BPS|PERCENT|STAMINA|PER_TICK|PER_RANK|LIMIT|CAP|SHARE|BASE|STEPS)$/;

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
  };
}

export async function readRuleConstants(root) {
  const [source, roster, days] = await Promise.all([
    readFile(new URL("src/rules.cairo", root), "utf8"),
    readFile(new URL("src/roster_limits.cairo", root), "utf8"),
    readFile(new URL("src/day_schedule.cairo", root), "utf8"),
  ]);
  const shared = { ...unsignedConstants(roster), ...unsignedConstants(days) };
  const resolved = source.replace(
    /^pub const ([A-Z][A-Z0-9_]*): u32 = crate::(?:roster_limits|days)::([A-Z][A-Z0-9_]*);$/gm,
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

async function readResearchConstants(root) {
  return unsignedConstants(await readFile(new URL("src/research.cairo", root), "utf8"), "8");
}

async function readOathConstants(root) {
  return unsignedConstants(await readFile(new URL("src/oaths.cairo", root), "utf8"), "8|16");
}

async function readArrivalConstants(root) {
  const { SLOTS_PER_DAY } = unsignedConstants(await readFile(new URL("src/arrivals.cairo", root), "utf8"), "8");
  if (SLOTS_PER_DAY === undefined) throw new Error("Missing Cairo arrival slot count");
  return { SLOTS_PER_DAY };
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
