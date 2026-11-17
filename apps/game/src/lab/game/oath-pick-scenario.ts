import { chooseOath } from "@bibliothecadao/eternum";
import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { spireScenario } from "./spire-scenario";
import { wire, type LabScenario } from "./lab-chain";

export function oathPickScenario(full = false): LabScenario {
  const game = spireScenario();
  const key = { game_id: 1, explorer_id: SPIRE_ARMY };
  const progress = game.store.require("ArmyProgress", key);
  game.store.applyFacts([{
    model: "ArmyProgress", key: game.store.wireKeyOf("ArmyProgress", key)!,
    value: wire({ ...progress, oath_slots: 1, oaths: full ? 1 << (oaths.GIANTS - 1) : 0,
      oath_pick: (oaths.POWER - 1) + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8) }),
  }]);
  return { ...game, answer(command, chain, now) {
    if (command.kind !== "ChooseOath") return game.answer(command, chain, now);
    const fields = command.calldata.slice(5).map(Number);
    const explorer_id = fields.shift()!;
    const expected = fields.shift()!;
    const oath = fields.shift() === 0 ? fields.shift()! : null;
    const replace = fields.shift() === 0 ? fields.shift()! : null;
    if (fields.length) throw new Error("Extra Oath command fields");
    const current = chain.require("ArmyProgress", { game_id: 1, explorer_id });
    return [{ model: "ArmyProgress", key: chain.wireKeyOf("ArmyProgress", current)!,
      value: wire(chooseOath(current, expected, oath, replace)) }];
  } };
}
