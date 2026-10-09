import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { hash } from "starknet";

const root = new URL("../../../contracts/l3/world-native/src/", import.meta.url);
function chestEntropy(clock: bigint) {
  const caller = readFileSync(new URL("logic/lords_budget.cairo", root), "utf8");
  const expression = caller.match(/roll_tier\(odds, seed, ([^)]+)\)/)![1]!;
  if (expression.trim() === "context.timestamp") return clock;
  const name = expression.trim().split("::").at(-1)!;
  const constants = readFileSync(new URL("random.cairo", root), "utf8");
  const encoded = constants.match(new RegExp(`pub const ${name}: u64 = (0x[0-9a-f]+);`))?.[1];
  if (!encoded) throw new Error("Missing fixed draw domain");
  return BigInt(encoded);
}
test("the real Ruin tier caller gives the same draw for the same root at every clock", () => {
  const clocks = [0n, 360n, 86400n, (1n << 64n) - 1n];
  for (let seed = 1n; seed <= 32n; seed++) {
    const tiers = clocks.map(
      (clock) => (BigInt(hash.computePoseidonHashOnElements([seed, 0n, chestEntropy(clock) + 37n])) % 10000n) / 2000n,
    );
    expect(new Set(tiers).size).toBe(1);
  }
});

test("Explore pays every root-independent stamina/food cost before its first discovery draw", () => {
  const source = readFileSync(new URL("logic/movement.cairo", root), "utf8");
  const start = source.indexOf("fn explore(");
  const end = source.indexOf("\n        fn ", start + 1);
  const explore = source.slice(start, end < 0 ? source.length : end);
  expect(explore.indexOf("self.pay_movement(")).toBeGreaterThan(0);
  expect(explore.indexOf("discover_frontier_tile(")).toBeGreaterThan(0);
  expect(explore.indexOf("self.pay_movement(") < explore.indexOf("discover_frontier_tile(")).toBe(true);
  expect(explore.indexOf("self.pay_movement(") < explore.indexOf(".discovery(")).toBe(true);
});
