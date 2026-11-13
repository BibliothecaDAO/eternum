import { configManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useBlockTimestampStore } from "@/hooks/store/use-block-timestamp-store";
import { useCurrentArmy } from "./use-armies";
import preset from "../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import explorer from "../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";

const context = vi.hoisted(() => ({ store: null as unknown }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: context.store } }) }));
vi.mock("@/hooks/use-player-profile", () => ({ usePlayerNames: () => ({ text: () => undefined }) }));
afterEach(() => setBlockTimestampSource(null));

it("shows 500, 300, 100 and zero troops on confirmed ticks without writing a troop row", async () => {
  const store = new NativeFactStore();
  context.store = store;
  store.applyFacts([
    {
      model: "SliceRules",
      key: "1",
      value: {
        ...preset.rules,
        game_id: 1,
        day_unit_seconds: 1000,
        tick_config: { ...preset.rules.tick_config, armies_tick_in_seconds: 120 },
      },
    },
    {
      model: "GameRegistry",
      key: "1",
      value: {
        game_id: 1,
        name: 1,
        preset_id: 1,
        settled: false,
        ready: true,
        dev_mode_on: false,
        start_settling_at: 0,
        start_main_at: 300,
        end_at: 10000,
        end_grace_seconds: 0,
        seed: 1,
      },
    },
    {
      model: "SettlementRules",
      key: "1",
      value: { game_id: 1, registration_start: 0, registration_limit: 0, spacing: 100, mode: "Single" },
    },
    {
      model: "DeepRules",
      key: "1",
      value: {
        game_id: 1,
        foundation: { alt: false, x: 25, y: 35 },
        quarry: { alt: false, x: 12, y: 20 },
        altar: { alt: false, x: 38, y: 20 },
        beast_count: 10000n,
        loss_per_tick: 200n,
        quarry_per_tick: 500n,
        altar_per_tick: 5,
        altar_threshold: 1500,
      },
    },
    { model: "ArmyDay", key: "81", value: { game_id: 1, explorer_id: 81, day: 0 } },
    { model: "DeepArmy", key: "81", value: { game_id: 1, explorer_id: 81, last_tick: 2 } },
    {
      model: "ExplorerTroops",
      key: "81",
      value: {
        ...explorer.expected.value,
        game_id: 1,
        explorer_id: 81,
        troops: { ...explorer.expected.value.troops, count: 500n },
      },
    },
  ]);
  let timestamp = 350;
  configManager.setActiveGame(1, 1);
  configManager.setStore(store);
  setBlockTimestampSource(() => timestamp);
  useBlockTimestampStore.getState().tick();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  function Army() {
    return <span>{String(useCurrentArmy({ game_id: 1, explorer_id: 81 })?.troops.count)}</span>;
  }
  await act(async () => root.render(<Army />));
  expect(container.textContent).toBe("500");
  try {
    for (const [time, count] of [
      [360, 300n],
      [480, 100n],
      [600, 0n],
    ] as const) {
      await act(async () => {
        timestamp = time;
        useBlockTimestampStore.getState().tick();
      });
      expect(container.textContent).toBe(String(count));
      expect(store.require("ExplorerTroops", { game_id: 1, explorer_id: 81 }).troops.count).toBe(500n);
    }
  } finally {
    await act(async () => root.unmount());
  }
});
