import { readFile } from "node:fs/promises";

/** Preserve declaration order: schema identity hashes the serialized constant map. */
export async function readRuleConstants(root) {
  const [source, roster, days] = await Promise.all([
    readFile(new URL("src/rules.cairo", root), "utf8"),
    readFile(new URL("src/roster_limits.cairo", root), "utf8"),
    readFile(new URL("src/days.cairo", root), "utf8"),
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

function unsignedConstants(source) {
  return Object.fromEntries(
    [...source.matchAll(/^pub const ([A-Z][A-Z0-9_]*): u(?:8|32) = ([0-9]+);$/gm)].map(([, name, value]) => [
      name,
      Number(value),
    ]),
  );
}

export async function readQuestConstants(root) {
  return unsignedConstants(await readFile(new URL("src/quests.cairo", root), "utf8"));
}

/** Release behavior is not part of the immutable fact wire schema. */
export async function readReleaseConstants(root) {
  return unsignedConstants(await readFile(new URL("src/logic/release.cairo", root), "utf8"));
}
