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
  return { host, attack, button };
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
