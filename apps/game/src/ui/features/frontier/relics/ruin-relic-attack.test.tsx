import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useNowSeconds: () => 350,
  useCurrentBlockTimestamp: () => 350,
  useCurrentArmiesTick: () => 3,
  useCurrentDefaultTick: () => 350,
  useBlockTimestamp: () => ({ currentArmiesTick: 3, armiesTickTimeRemaining: 60 }),
}));
vi.mock("@/audio/unit-command-audio", () => ({ playUnitCommandSound: () => {} }));
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  // Each attack's outcome, applied as the chain answers it, so no order stays in flight into the next case.
  requireActiveGameClient: () => ({
    waitForAction: () => Promise.resolve({ hash: "0x1", block: 9, status: "SUCCEEDED" }),
  }),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";

import { campBeside, placeSite, SITE, SITE_TILE } from "../sites/site-fixture";
import { TileCard } from "../sites/tile-card";
import { ruinRelicState } from "./ruin-relic-choice";
import { RELIC_WORDS } from "@/ui/design-system/kit/words";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let unmount = () => {};
afterEach(() => {
  unmount();
  act(() => useUIStore.getState().selectOnMap(null));
});

const EPIC_BLADE = { model: "RuinRelic", key: "0xb1", value: { game_id: 1, entity_id: SITE, kind: "Blade", rank: 4 } };
const EMPTY_RELICS = { blade: 0, ward: 0, plunder: 0, stamina_regen: 0, antidote: 0 };

const ruinCard = (carried: Partial<typeof EMPTY_RELICS> = {}, rewardDelivered = true) => {
  const { store, site, structure } = campBeside("Ruin");
  placeSite(store);
  store.applyFacts([
    ...(rewardDelivered ? [EPIC_BLADE] : []),
    {
      model: "ArmyRelics",
      key: "0xb2",
      value: { game_id: 1, explorer_id: 201, ...EMPTY_RELICS, ...carried },
    },
  ] as never);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  const attack = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
  const tile = { hexCoords: SITE_TILE, biome: 11, occupierId: SITE } as unknown as TileSpatialRenderable;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls: { attack_explorer_vs_guard: attack } } as unknown as GameClientSetup}
        account={{ address: "0x111", account: {} } as never}
      >
        <TileCard selected={{ kind: "site", site, structure, tile }} onClose={() => {}} />
      </GameProvider>,
    ),
  );
  act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null }));
  unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  const button = (word: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes(word));
  return { host, attack, button, store };
};

it("names the relic the ruin guards in what its clear pays, and previews filling the kind slot", async () => {
  const { host, attack, button } = ruinCard();
  expect(host.querySelector("[data-ruin-relic]")?.getAttribute("aria-label")).toBe("Reward: Epic Blade");
  expect(host.querySelector("[data-relic-effect]")?.textContent).toBe("Damage dealt: 100% → 140%");
  expect(host.querySelector('[data-relic-outcome="Collected"]')?.textContent).toContain(
    RELIC_WORDS.previewCollected(RELIC_WORDS.kinds.Blade),
  );
  await act(async () => button("Attack")!.click());
  expect(attack).toHaveBeenCalledWith(expect.objectContaining({ explorer_id: 201, structure_id: SITE }));
});

it("names a ruin's Ancient cache in place of its relic", async () => {
  const { host, attack, button, store } = ruinCard({ blade: 4, ward: 3, plunder: 2, stamina_regen: 1, antidote: 1 });
  act(() =>
    store.applyFacts([
      { model: "RuinCache", key: "0xbc", value: { game_id: 1, entity_id: SITE, fragments: 12 } },
    ] as never),
  );
  expect(host.querySelector("[data-ruin-cache]")?.textContent).toBe(RELIC_WORDS.cache(12));
  expect(host.querySelector("[data-ruin-relic]")).toBeNull();
  expect(host.querySelector("[data-relic-outcome]")).toBeNull();
  await act(async () => button("Attack")!.click());
  expect(attack).toHaveBeenCalledWith(expect.objectContaining({ explorer_id: 201, structure_id: SITE }));
});

it("previews automatic merge, replace, and discard outcomes without blocking the attack", async () => {
  const { host, attack, button, store } = ruinCard({ blade: 4 });
  expect(host.querySelector('[data-relic-outcome="Merged"]')?.textContent).toContain(
    RELIC_WORDS.previewMerged("IV", "V"),
  );
  act(() =>
    store.applyFacts([
      { model: "ArmyRelics", key: "0xb2", value: { game_id: 1, explorer_id: 201, ...EMPTY_RELICS, blade: 2 } },
    ] as never),
  );
  expect(host.querySelector('[data-relic-outcome="Replaced"]')?.textContent).toContain(
    RELIC_WORDS.previewReplaced("II", "IV"),
  );
  act(() =>
    store.applyFacts([
      { model: "ArmyRelics", key: "0xb2", value: { game_id: 1, explorer_id: 201, ...EMPTY_RELICS, blade: 5 } },
    ] as never),
  );
  expect(host.querySelector('[data-relic-outcome="Discarded"]')?.textContent).toContain(
    RELIC_WORDS.previewDiscarded("V"),
  );
  await act(async () => button("Attack")!.click());
  expect(attack).toHaveBeenCalledWith(expect.objectContaining({ explorer_id: 201, structure_id: SITE }));
});

it("withholds the attack while the ruin's reward or the army's relics are still arriving", async () => {
  const { host, attack, button, store } = ruinCard({ blade: 2 }, false);
  act(() => store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 }));
  expect(host.querySelector("[data-ruin-relic]")).toBeNull();
  expect(host.textContent).toContain(RELIC_WORDS.readingRuin);
  expect(button("Attack")?.disabled ?? true).toBe(true);
  await act(async () => button("Attack")?.click());
  expect(attack).not.toHaveBeenCalled();
  act(() => store.applyFacts([EPIC_BLADE] as never));
  expect(host.querySelector("[data-ruin-relic]")?.getAttribute("aria-label")).toBe("Reward: Epic Blade");
  expect(host.textContent).toContain(RELIC_WORDS.reading);
  expect(button("Attack")?.disabled ?? true).toBe(true);
  act(() => store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 350 }));
  expect(
    ruinRelicState(store, store.require("ExpeditionSite", { game_id: 1, entity_id: SITE }), 201, 350),
  ).toMatchObject({ kind: "outcome", outcome: "Replaced", previousRank: 2, resultRank: 4 });
  await act(async () => button("Attack")!.click());
  expect(attack).toHaveBeenCalledTimes(1);
});
