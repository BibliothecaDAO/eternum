import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentBlockTimestamp: () => 1_000 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));

import { GameProvider } from "@/hooks/context/game-context";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { configManager } from "@bibliothecadao/eternum";

import { campBeside } from "../sites/site-fixture";
import { ArmyRelicSlots } from "./army-relic-slots";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(() => act(() => root?.unmount()));

/** Army 201 carrying an Uncommon Blade and a Common Tome, a Rare Ward running until second 2,800, at second 1,000. */
const armyWithRelics = () => {
  const { store } = campBeside();
  configManager.setActiveGame(1, 7);
  store.applyFacts([
    {
      model: "ArmyRelics",
      key: "0xa1",
      value: {
        game_id: 1,
        explorer_id: 201,
        first: { kind: "Blade", rank: 2 },
        second: null,
        third: { kind: "Tome", rank: 1 },
      },
    },
    {
      model: "ArmyRelicEffect",
      key: "0xa2",
      value: { game_id: 1, explorer_id: 201, kind: "Ward", rank: 3, expires_at: 2_800 },
    },
    {
      model: "ArmyRelicEffect",
      key: "0xa3",
      value: { game_id: 1, explorer_id: 201, kind: "Tome", rank: 2, expires_at: 900 },
    },
  ] as never);
  return store;
};

const draw = (store: ReturnType<typeof armyWithRelics>) => {
  const apply = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
  const host = document.createElement("div");
  root = createRoot(host);
  act(() =>
    root!.render(
      <GameProvider
        value={{ store, systemCalls: { apply_relic: apply } } as unknown as GameClientSetup}
        account={{ address: "0x111", account: {} } as never}
      >
        <ArmyRelicSlots explorerId={201} />
      </GameProvider>,
    ),
  );
  return { host, apply };
};

it("shows the relics running with their time left, then the three slots with what each relic does", () => {
  const { host } = draw(armyWithRelics());
  // The Tome's effect ended at second 900: only the Ward runs, 30 minutes left.
  expect(host.querySelector("[data-relics-running]")?.textContent).toBe("Rare Ward · 30m left");
  const rows = [...host.querySelectorAll("[data-army-relics] .ui-row")].map((row) => row.textContent);
  expect(rows).toEqual(["Uncommon Blade+20% damage dealtSwitch on", "Empty slot", "Common Tome+40% XPSwitch on"]);
});

it("switches a relic on for free, naming its slot and the id the contract decodes", async () => {
  const { host, apply } = draw(armyWithRelics());
  const button = host.querySelector<HTMLButtonElement>('button[aria-label="Switch on Common Tome"]')!;
  await act(async () => button.click());
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ entity_id: 201, relic_resource_id: 21, relic_slot: 2 }));
});

it("shows nothing for an army that carries and runs no relic", () => {
  const { store } = campBeside();
  configManager.setActiveGame(1, 7);
  store.applyFacts([
    {
      model: "ArmyRelics",
      key: "0xa1",
      value: { game_id: 1, explorer_id: 201, first: null, second: null, third: null },
    },
  ] as never);
  const { host } = draw(store as never);
  expect(host.innerHTML).toBe("");
});
