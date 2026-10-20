// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => [] }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 3,
  useCurrentArmiesTick: () => 3,
  useCurrentBlockTimestamp: () => 350,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { configManager, getEntityName, getTroopResourceId, setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, TroopTier, TroopType } from "@bibliothecadao/types";

import { useArmyCreation } from "../components/unified-army-creation-modal/use-army-creation";
import { readSurvivalAdvice } from "./survival-advice";

afterEach(() => {
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

const P = BigInt(RESOURCE_PRECISION);
const KNIGHT = getTroopResourceId(TroopType.Knight, TroopTier.T1);
const PALADIN = getTroopResourceId(TroopType.Paladin, TroopTier.T1);

const army = (explorerId: number, owner: number) => ({
  model: "ExplorerTroops",
  key: `0x${explorerId.toString(16)}`,
  value: {
    game_id: 1,
    explorer_id: explorerId,
    owner,
    troops: {
      category: "Knight",
      tier: "T1",
      count: String(1_000n * P),
      stamina: { Inline: { amount: "150", settled_at: "350", remainder: 0 } },
      battle_cooldown_end: "0",
      boosts: {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_at: "0",
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_at: "0",
        incr_stamina_regen_percent_num: 0,
        incr_stamina_regen_seconds_left: 0,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_at: "0",
      },
    },
  },
});

/**
 * The audit's case: Home (level 0, a 1,500 cap) sends 1,000 T1 Knights that need 1,400 more, and the player owns a
 * second realm at level 1 (a 15,000 cap) holding `held` troops with `slots` field army slots, one of them filled when
 * `armyThere`.
 */
const twoRealms = ({
  held,
  slots = 3,
  armyThere = false,
}: {
  held: Record<number, bigint>;
  slots?: number;
  armyThere?: boolean;
}) => {
  const { store, row } = frontierDay();
  vi.spyOn(configManager, "getMaxArmySize").mockImplementation((level) => (level === 0 ? 1_500 : 15_000));
  store.applyFacts([
    { model: "UpgradeLimits", key: "0x9", value: { game_id: 1, realm_max: 3, village_max: 0 } },
    // A day without expeditions: every army at home counts toward its realm's slots.
    {
      model: "SliceRules",
      key: "0x100",
      value: { ...store.require("SliceRules", { game_id: 1 }), day_unit_seconds: 0 },
    },
    {
      model: "Structure",
      key: "0x8a",
      value: {
        ...row,
        entity_id: 8,
        base: { ...row.base, level: 1, troop_max_explorer_count: slots },
        metadata: { ...row.metadata, realm_id: 2 },
      },
    },
    {
      model: "ResourceWeight",
      key: "0x6a",
      value: { game_id: 1, entity_id: 8, capacity: "100000000000000", weight: "0" },
    },
    {
      model: "TileOccupancy",
      key: "0xe8",
      value: { game_id: 1, alt: false, col: 4, row: 4, entity_id: 8, category: row.base.category, is_structure: true },
    },
    { model: "RealmKnowledge", key: "0xd8", value: { game_id: 1, structure_id: 8, learned: "0" } },
    army(70, 7),
    ...(armyThere ? [army(80, 8)] : []),
    ...Object.entries(held).map(([resource, count]) => ({
      model: "ResourceBalance",
      key: `0xb${resource}`,
      value: { game_id: 1, entity_id: 8, resource_type: Number(resource), balance: String(count * P) },
    })),
  ] as never);
  const advice = readSurvivalAdvice(
    store,
    { id: 70, troops: { category: TroopType.Knight, tier: TroopTier.T1, count: 1_000n * P } },
    1_400n * P,
    350,
  );
  return { store, advice, other: getEntityName(8, store), home: getEntityName(7, store) };
};

/** The Military window on the second realm: whether it can raise a field army, and the most troops one can take. */
const militaryOnSecondRealm = (store: ReturnType<typeof twoRealms>["store"]) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const State = () => {
    const form = useArmyCreation({ structureId: 8, isExplorer: true });
    return <p>{JSON.stringify({ canRaise: form.canCreateAttackArmy, most: form.maxAffordable })}</p>;
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <State />
        </GameProvider>,
      ),
    );
    return JSON.parse(host.textContent!);
  } finally {
    act(() => root.unmount());
  }
};

describe("the realm a certain loss's advice sends the player to", () => {
  it("is not offered as ready when it has the cap but no troops: it says the troops to train there first", () => {
    const { advice, other } = twoRealms({ held: { [KNIGHT]: 0n } });
    expect(advice).not.toContain("raise one from");
    expect(advice).toContain(`train 2,400 more T1 Knight at ${other} and raise one there (cap 15,000)`);
  });

  it("does not count troops of another kind toward the army", () => {
    const { advice, other } = twoRealms({ held: { [PALADIN]: 3_000n } });
    expect(advice).not.toContain("raise one from");
    expect(advice).toContain(`train 2,400 more T1 Knight at ${other}`);
  });

  it("is left out when its field army slots are full, as the Military window refuses it there", () => {
    const { store, advice, home } = twoRealms({ held: { [KNIGHT]: 3_000n }, slots: 1, armyThere: true });
    expect(advice).toBe(`it needs about 2,400 troops, and ${home}'s army cap is 1,500: level it to City (cap 15,000)`);
    expect(militaryOnSecondRealm(store)).toEqual({ canRaise: false, most: 0 });
  });

  it("is offered when it holds the troops, has a free slot and the cap, as the Military window would raise it", () => {
    const { store, advice, other } = twoRealms({ held: { [KNIGHT]: 3_000n } });
    expect(advice).toContain(`or raise one from ${other} (cap 15,000)`);
    expect(militaryOnSecondRealm(store)).toEqual({ canRaise: true, most: 3_000 });
  });
});
