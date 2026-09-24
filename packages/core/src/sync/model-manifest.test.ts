import { describe, expect, it } from "vitest";
import { nativeSyncScopes } from "../../../../contracts/l3/world-native/schema/client.gen";
import { gameSyncRegion, rowInGameSyncScope, syncScalar, type GameSyncScope } from "./model-manifest";

const SPACING = 21;
const SETS = ["owners", "entities", "realms", "realmTraits", "productionSources"] as const;

type Rule = Partial<Record<(typeof SETS)[number], readonly string[]>> & {
  regions?: readonly { alt: string; x: string; y: string }[];
  epoch?: string;
};

/**
 * The membership rule as the schema declares it, written out: an actor row belongs to its actor, a shared row to
 * everyone, and a scoped row to a scope with no expedition or to the expedition naming one of its sets or regions on
 * its day. The key encoding must admit exactly these.
 */
const declaredMembership = (model: string, row: Record<string, unknown>, scope: GameSyncScope): boolean => {
  const rule = nativeSyncScopes[model as keyof typeof nativeSyncScopes] as "shared" | "actor" | Rule;
  if (rule === "actor") return scope.actor !== undefined && syncScalar(row.actor) === syncScalar(scope.actor);
  const expedition = scope.expedition;
  if (!expedition || rule === "shared") return true;
  if (rule.epoch !== undefined && Number(row[rule.epoch]) !== expedition.epoch) return false;
  const named = SETS.some((set) => (rule[set] ?? []).some((field) => expedition[set].has(syncScalar(row[field]))));
  const inRegion = (rule.regions ?? []).some((region) => {
    const key = gameSyncRegion({ alt: row[region.alt], x: row[region.x], y: row[region.y] }, expedition.spacing);
    return key !== undefined && expedition.regions.has(key);
  });
  return named || inRegion;
};

/** A small deterministic generator, so a failure names a reproducible trial. */
const random = (seed: number) => () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
  return seed / 2 ** 31;
};

describe("rowInGameSyncScope", () => {
  it("admits exactly the rows the declared rule gives a scope, for every model in the schema", () => {
    const next = random(7);
    const pick = <T>(values: readonly T[]): T => values[Math.floor(next() * values.length)]!;
    // Identities arrive as decimal, hex and bigint forms; the scope holds normalized decimals.
    const identity = () => pick<unknown>(["1", "2", "3", "0x2", 3n, 1]);
    const subset = () => new Set(["1", "2", "3"].filter(() => next() < 0.4));
    const scope = (): GameSyncScope => {
      const actor = pick([undefined, "0x1", "0x2"]);
      if (next() < 0.2) return { actor };
      return {
        actor,
        expedition: {
          epoch: pick([0, 1, 2]),
          spacing: SPACING,
          owners: subset(),
          realms: subset(),
          entities: subset(),
          productionSources: subset(),
          realmTraits: subset(),
          regions: new Set(["0:0", "1:0", "0:1", "2:2"].filter(() => next() < 0.4)),
        },
      };
    };
    const row = (model: string): Record<string, unknown> => {
      const rule = nativeSyncScopes[model as keyof typeof nativeSyncScopes] as unknown;
      const value: Record<string, unknown> = { actor: pick(["0x1", "0x2", 2n]) };
      if (typeof rule === "string") return value;
      const fields = rule as Partial<Record<string, readonly string[]>> & {
        regions?: readonly { alt: string; x: string; y: string }[];
        epoch?: string;
      };
      for (const set of SETS) for (const field of fields[set] ?? []) value[field] = identity();
      for (const region of fields.regions ?? []) {
        value[region.alt] = next() < 0.2;
        value[region.x] = Math.floor(next() * SPACING * 3);
        value[region.y] = pick([Math.floor(next() * SPACING * 3), `0x${Math.floor(next() * 63).toString(16)}`]);
      }
      if (fields.epoch) value[fields.epoch] = pick([0, 1, 2, "0x1"]);
      return value;
    };

    for (const model of Object.keys(nativeSyncScopes)) {
      for (let trial = 0; trial < 300; trial++) {
        const [facts, held] = [row(model), scope()];
        expect(rowInGameSyncScope(model, facts, held), `${model} trial ${trial}`).toBe(
          declaredMembership(model, facts, held),
        );
      }
    }
  });
});
