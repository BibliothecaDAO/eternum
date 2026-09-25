import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { expect, it } from "vitest";
import { buildLabDay, LAB_PLAYER } from "./frontier-hud-lab-facts";

it("provides the progress fact needed to resolve each lab army's slot bar", () => {
  const day = buildLabDay([
    {
      model: "SliceRules",
      value: {
        ...preset.rules,
        game_id: 1,
        epoch_seconds: 86400,
        tick_config: { ...preset.rules.tick_config, armies_tick_in_seconds: 120 },
        troop_stamina_config: { ...preset.rules.troop_stamina_config, stamina_knight_max: 150, stamina_initial: 150 },
      },
    },
    {
      model: "SettlementRules",
      value: { game_id: 1, spacing: 40, registration_start: 0, registration_limit: 0, mode: "Single" },
    },
  ]);
  const store = new NativeFactStore();
  store.applyFacts(day.facts);
  store.setSnapshot({ gameId: day.gameId, complete: true, actor: LAB_PLAYER, timestamp: day.nowSeconds });
  const troops = [...store.inGame("ExplorerTroops", day.gameId)].map((army) => resolveExplorerTroops(store, army));
  expect(troops.map((army) => army?.stamina.amount)).toEqual([30n, 150n]);
  expect(troops.map((army) => army?.staminaMax)).toEqual([150, 150]);
});
