import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { expect, it } from "vitest";
import { currentArmy, nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { encodeNativeCommand } from "@bibliothecadao/provider";
import { nativeBindings } from "@/runtime/world/native-bindings";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { chainOf } from "./lab-chain";
import { LAB_SCENARIOS } from "./lab-games";

it("settles the lab's old Deep rate before the Oath response, matching the native choice", () => {
  const game = LAB_SCENARIOS["oath-vitriol"]!();
  const chain = chainOf(game);
  const key = { game_id: 1, explorer_id: SPIRE_ARMY };
  const before = chain.require("ExplorerTroops", key);
  const progress = chain.require("ArmyProgress", key);
  const interval = Number(chain.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds);
  const boundary = (Math.floor(game.startsAt / interval) + 1) * interval;
  const span = encodeNativeCommand(nativeBindings.commandAbi, {
    kind: "ChooseOath",
    value: {
      explorer_id: SPIRE_ARMY,
      expected_pick: progress.oath_pick,
      oath: { kind: "Some", value: oaths.VITRIOL },
      replace: { kind: "None", value: undefined },
    },
  });
  chain.applyFacts(game.answer({ kind: "ChooseOath", fields: {}, span }, chain, boundary) as never);
  const after = chain.require("ExplorerTroops", key);
  expect(after.troops.count).toBe(before.troops.count - chain.require("DeepRules", { game_id: 1 }).loss_per_tick);
  expect(chain.require("DeepArmy", key).last_tick).toBe(BigInt(boundary / interval));
  expect(chain.require("ArmyProgress", key).oaths).toBe(1 << (oaths.VITRIOL - 1));
  expect(currentArmy(chain, after, boundary).troops.count).toBe(after.troops.count);
  expect(currentArmy(chain, after, boundary + interval).troops.count).toBe(
    after.troops.count - BigInt(oaths.VITRIOL_LOSS_PER_TICK) * BigInt(RESOURCE_PRECISION),
  );
});
