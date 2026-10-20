import { describe, expect, it } from "vitest";
import { nativeStoryVariants, nativeSyncScopes } from "../../../../contracts/l3/world-native/schema/client.gen";
import { gameSyncRegion, gameSyncRowKeys, rowInGameSyncScope, syncScalar, type GameSyncScope } from "./model-manifest";

const SPACING = 21;
const SETS = ["owners", "entities", "realms", "realmTraits"] as const;

type Rule = Partial<Record<(typeof SETS)[number], readonly string[]>> & {
  regions?: readonly { alt: string; x: string; y: string }[];
  epoch?: string;
};

/**
 * Default membership as the schema declares it (chest receipts are tested separately): an actor row belongs to its
 * actor, a shared row to everyone, and a scoped row to a scope with no expedition or one naming its sets or regions on
 * its day. The key encoding must admit exactly these.
 */
const declaredMembership = (model: string, row: Record<string, unknown>, scope: GameSyncScope): boolean => {
  const rule = nativeSyncScopes[model as keyof typeof nativeSyncScopes] as "shared" | "actor" | "internal" | Rule;
  if (rule === "internal") return false;
  if (rule === "actor") return scope.actor !== undefined && syncScalar(row.actor) === syncScalar(scope.actor);
  const expedition = scope.expedition;
  if (!expedition || rule === "shared") return true;
  if (rule.epoch !== undefined && Number(row[rule.epoch]) !== expedition.day) return false;
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
  it("shares only discovery-chest and ruin-payout stories, leaving every other variant with its owner", () => {
    const peer: GameSyncScope = {
      actor: "0x2",
      expedition: {
        day: 0,
        spacing: SPACING,
        owners: new Set(["2"]),
        entities: new Set(),
        realms: new Set(),
        realmTraits: new Set(),
        regions: new Set(),
      },
    };
    for (const kind of nativeStoryVariants) {
      const row = { owner: "0x1", story: { [kind]: {} } };
      const shared = kind === "RewardChestOpened";
      expect(gameSyncRowKeys("StoryEvent", row, SPACING), kind).toEqual(shared ? "shared" : ["*", "owners:1"]);
      expect(rowInGameSyncScope("StoryEvent", row, peer), kind).toBe(shared);
    }
    for (const category of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, "0xa", 10n]) {
      const row = { owner: "0x1", story: { SitePayout: { category } } };
      expect(gameSyncRowKeys("StoryEvent", row, SPACING)).toEqual(
        Number(category) === 10 ? "shared" : ["*", "owners:1"],
      );
      expect(rowInGameSyncScope("StoryEvent", row, peer)).toBe(Number(category) === 10);
    }
    expect(
      gameSyncRowKeys("ExplorerTroops", { explorer_id: "0x1", story: { RewardChestOpened: {} } }, SPACING),
    ).toEqual(["*", "entities:1"]);
  });

  it("admits non-chest rows according to the declared scope rule, for every model in the schema", () => {
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
          day: pick([0, 1, 2]),
          spacing: SPACING,
          owners: subset(),
          realms: subset(),
          entities: subset(),
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
