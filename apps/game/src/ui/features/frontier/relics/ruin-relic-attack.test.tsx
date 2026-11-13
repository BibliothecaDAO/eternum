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

import { campBeside, SITE, SITE_TILE } from "../sites/site-fixture";
import { TileCard } from "../sites/tile-card";
import { ruinRelicState } from "./ruin-relic-choice";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let unmount = () => {};
afterEach(() => {
  unmount();
  act(() => useUIStore.getState().selectOnMap(null));
});

/** The fixture's ruin guarding an Epic Blade, army 201 beside it carrying the relics given (null: an empty slot). */
const ruinCard = (carried: [unknown, unknown, unknown]) => {
  const { store, site, structure } = campBeside("Ruin");
  store.applyFacts([
    { model: "RuinRelic", key: "0xb1", value: { game_id: 1, entity_id: SITE, kind: "Blade", rank: 4 } },
    {
      model: "ArmyRelics",
      key: "0xb2",
      value: { game_id: 1, explorer_id: 201, first: carried[0], second: carried[1], third: carried[2] },
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

const FULL = [
  { kind: "Ward", rank: 1 },
  { kind: "Tome", rank: 2 },
  { kind: "Plunder", rank: 1 },
] as [unknown, unknown, unknown];

it("names the relic the ruin guards in what its clear pays", () => {
  const { host } = ruinCard([null, null, null]);
  expect(host.querySelector("[data-ruin-relic]")?.getAttribute("aria-label")).toBe("Pays a relic: Epic Blade");
});

it("attacks with no slot named while the army has room: the contract fills a free one", async () => {
  const { host, attack, button } = ruinCard([{ kind: "Ward", rank: 1 }, null, null]);
  expect(host.querySelector("[data-relic-replacement]")).toBeNull();
  await act(async () => button("Attack")!.click());
  expect(attack).toHaveBeenCalledWith(
    expect.objectContaining({ explorer_id: 201, structure_id: SITE, relic_slot: undefined }),
  );
});

it("holds a full army's attack until the player picks the relic it replaces, then sends that slot", async () => {
  const { host, attack, button } = ruinCard(FULL);
  expect(host.querySelector("[data-relic-replacement]")).not.toBeNull();
  // The choice said once, above it; the held step says what is left to do.
  expect(host.textContent?.split("Your army carries 3 relics. Choose the one this relic replaces.")).toHaveLength(2);
  expect(host.textContent).toContain("Choose the relic to replace first");
  // No Attack can leave before the choice: the card's step says why instead.
  expect(button("Attack")?.disabled ?? true).toBe(true);
  const replaceTome = host.querySelector<HTMLButtonElement>(
    '[data-relic-replacement] button[aria-label="Replace Uncommon Tome"]',
  )!;
  act(() => replaceTome.click());
  await act(async () => button("Attack")!.click());
  expect(attack).toHaveBeenCalledTimes(1);
  expect(attack).toHaveBeenCalledWith(expect.objectContaining({ explorer_id: 201, structure_id: SITE, relic_slot: 1 }));
});

it("asks again when the chosen slot's relic changes, and sends only the fresh choice", async () => {
  const { host, attack, button, store } = ruinCard(FULL);
  act(() => host.querySelector<HTMLButtonElement>('[aria-label="Replace Uncommon Tome"]')!.click());
  // The chain moves a Legendary Ward into that slot: the choice named the Tome, so it no longer stands.
  act(() =>
    store.applyFacts([
      {
        model: "ArmyRelics",
        key: "0xb2",
        value: { game_id: 1, explorer_id: 201, first: FULL[0], second: { kind: "Ward", rank: 5 }, third: FULL[2] },
      },
    ] as never),
  );
  expect(host.textContent).toContain("Legendary Ward");
  expect(host.textContent).toContain("Choose the relic to replace first");
  expect(host.querySelector('[data-relic-replacement] [aria-selected="true"]')).toBeNull();
  await act(async () => button("Attack")?.click());
  expect(attack).not.toHaveBeenCalled();
  // A fresh choice of that same slot, now holding the Ward, goes.
  act(() => host.querySelector<HTMLButtonElement>('[aria-label="Replace Legendary Ward"]')!.click());
  await act(async () => button("Attack")!.click());
  expect(attack).toHaveBeenCalledTimes(1);
  expect(attack).toHaveBeenCalledWith(expect.objectContaining({ structure_id: SITE, relic_slot: 1 }));
});

it("keeps a standing choice while unrelated facts change", async () => {
  const { host, attack, button, store } = ruinCard(FULL);
  act(() => host.querySelector<HTMLButtonElement>('[aria-label="Replace Common Plunder"]')!.click());
  // Another kind's effect starts running: the carried relics are the same, so the choice stands.
  act(() =>
    store.applyFacts([
      {
        model: "ArmyRelicEffect",
        key: "0xb3",
        value: { game_id: 1, explorer_id: 201, kind: "Blade", rank: 2, expires_at: 9_000 },
      },
    ] as never),
  );
  await act(async () => button("Attack")!.click());
  expect(attack).toHaveBeenCalledWith(expect.objectContaining({ relic_slot: 2 }));
});

it("withholds the attack while the army's relics are not known, saying it reads them", async () => {
  const { host, attack, button, store } = ruinCard(FULL);
  // A snapshot not yet complete: the effects the army has none of cannot be told apart from ones not yet delivered.
  act(() => store.setSnapshot({ gameId: 1, complete: false, actor: "0x111", timestamp: 350 }));
  expect(host.querySelector("[data-relic-replacement]")).toBeNull();
  expect(host.textContent).toContain("Reading the army's relics…");
  expect(button("Attack")?.disabled ?? true).toBe(true);
  await act(async () => button("Attack")?.click());
  expect(attack).not.toHaveBeenCalled();
});

it("holds a choice only for the army and the ruin it was made for", () => {
  const { store } = ruinCard(FULL);
  const choice = { armyId: 201, ruinId: SITE, slot: 1 as const, held: { kind: "Tome" as const, rank: 2 } };
  const chosen = (ruinId: number, armyId: number) => {
    const state = ruinRelicState(store, ruinId, armyId, 350, choice);
    return state.kind === "full" ? state.chosen : state.kind;
  };
  expect(chosen(SITE, 201)).toBe(1);
  // Another ruin guarding a relic: the choice was made against this one, so it stands for no other.
  store.applyFacts([
    { model: "RuinRelic", key: "0xb9", value: { game_id: 1, entity_id: 999, kind: "Ward", rank: 1 } },
  ] as never);
  expect(chosen(999, 201)).toBeNull();
  // Another army carrying the very same relics: the choice was 201's, so it stands for no other army.
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  store.applyFacts([
    { model: "ExplorerTroops", key: "0xba", value: { ...army, explorer_id: 202 } },
    {
      model: "ArmyRelics",
      key: "0xbb",
      value: { game_id: 1, explorer_id: 202, first: FULL[0], second: FULL[1], third: FULL[2] },
    },
  ] as never);
  // (Its effects lie outside this store's scope, so they read unknown: either way it inherits no choice.)
  expect(chosen(SITE, 202)).not.toBe(1);
});
