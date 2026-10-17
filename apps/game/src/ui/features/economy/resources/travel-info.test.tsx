import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REALM = 1;
const BANK = 2;
/** 2026-10-17 01:37:40 UTC: 100 s into the 01:36-01:39 delivery tick. */
const NOW = Date.UTC(2026, 9, 17, 1, 37, 40) / 1000;
const store = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: store.current } }) }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 0, useNowSeconds: () => NOW }));
vi.mock("@/hooks/helpers/use-resources", () => ({
  useResourceManager: () => ({ balanceWithProduction: () => ({ balance: 1_000_000_000_000 }) }),
}));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));

import { TravelInfo } from "./travel-info";

/** A realm at (10, 10), 12 hex steps from its bank at (16, 22); goods 9 s a step, troops 27. */
const world = () => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getTick").mockReturnValue(180);
  vi.spyOn(configManager, "getSpeedConfig").mockImplementation((_kind, troops = false) => (troops ? 27 : 9));
  vi.spyOn(configManager, "getResourceWeightKg").mockReturnValue(1);
  vi.spyOn(configManager, "getCapacityConfigKg").mockReturnValue(50);
  const facts = new NativeFactStore();
  for (const [id, x, y, category] of [
    [REALM, 10, 10, StructureType.Realm],
    [BANK, 16, 22, StructureType.Bank],
  ])
    facts.applyFacts([
      {
        model: "Structure",
        key: String(id),
        value: {
          game_id: 1,
          entity_id: id,
          owner: 1n,
          base: {
            category,
            level: 0,
            created_at: 0,
            troop_max_guard_count: 4,
            troop_max_explorer_count: 4,
            starting_troops_granted: true,
          },
          metadata: { realm_id: id, order: 0, has_wonder: false, village_realm: 0, mine_kind: 0, deepest_depth: 0 },
          resources_packed: 0n,
        },
      },
      {
        model: "TileOccupancy",
        key: String(id),
        value: { game_id: 1, entity_id: id, col: x, row: y, alt: false, is_structure: true, category },
      },
    ] as never);
  return facts;
};

/** The clock the client shows an arrival in. */
const shown = (hours: number, minutes: number) => {
  const at = new Date(Date.UTC(2026, 9, 17, hours, minutes, 0));
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
};

let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  store.current = world();
  host = document.createElement("div");
});
afterEach(() => vi.restoreAllMocks());

/** The arrival a pickup of these goods from the bank shows, as swap and liquidity render it. */
const arrival = async (resources: Array<{ resourceId: ResourcesIds; amount: number }>) => {
  const root = createRoot(host);
  await act(async () => root.render(<TravelInfo entityId={REALM} bankId={BANK} resources={resources} isAmm />));
  const row = [...host.querySelectorAll("tr")].find((tr) => tr.textContent?.startsWith("Estimated Arrival"));
  const text = row?.querySelectorAll("td")[1].textContent?.trim();
  await act(async () => root.unmount());
  return text;
};

describe("a bank pickup's estimated arrival, as the chain lands it", () => {
  it("lands a swap's goods after the donkeys' round trip, at the end of its delivery tick", async () => {
    // Swap buying wheat: 24 steps × 9 s = 216 s from 01:37:40 ends at 01:41:16, in the 01:39-01:42 tick.
    expect(await arrival([{ resourceId: ResourcesIds.Wheat, amount: 100 }])).toBe(shown(1, 42));
    // Swap selling: the LORDS come back the same way.
    expect(await arrival([{ resourceId: ResourcesIds.Lords, amount: 100 }])).toBe(shown(1, 42));
  });

  it("lands a liquidity withdrawal with troops at the troops' pace", async () => {
    // LORDS and Knights from a troop pool: 24 × 27 s = 648 s ends at 01:48:28, in the 01:48-01:51 tick.
    expect(
      await arrival([
        { resourceId: ResourcesIds.Lords, amount: 100 },
        { resourceId: ResourcesIds.Knight, amount: 10 },
      ]),
    ).toBe(shown(1, 51));
  });
});
