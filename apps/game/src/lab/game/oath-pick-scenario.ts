import { seasonOneResearchPrices } from "./season-one-research";
import { chooseOath } from "@bibliothecadao/eternum";
import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { encodeNativeCommand } from "@bibliothecadao/provider";
import { nativeBindings } from "@/runtime/world/native-bindings";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { spireScenario } from "./spire-scenario";
import { wire, type LabCommand, type LabFact, type LabScenario } from "./lab-chain";

export function oathPickScenario(full = false, game = spireScenario(), fightOath: number = oaths.POWER): LabScenario {
  prepareOathArmy(game.store, full, fightOath);
  return {
    ...game,
    answer: (command, chain, now) =>
      answerDeletion(command, chain) ?? answerChoice(command, chain) ?? game.answer(command, chain, now),
  };
}

function prepareOathArmy(store: NativeFactStore, full: boolean, fightOath: number) {
  const key = { game_id: 1, explorer_id: SPIRE_ARMY };
  const progress = store.require("ArmyProgress", key);
  const army = store.require("ExplorerTroops", key);
  const day = store.require("ArmyDay", key);
  const rules = store.require("SliceRules", { game_id: key.game_id });
  const slot = { game_id: key.game_id, structure_id: army.owner, epoch: BigInt(day.day), slot: 0 };
  store.applyFacts([
    ...seasonOneResearchPrices(store),
    {
      model: "ExplorerTroops",
      key: store.wireKeyOf("ExplorerTroops", key)!,
      value: wire({ ...army, troops: { ...army.troops, stamina: { Slot: slot.slot } } }),
    },
    {
      model: "ArmySlot",
      key: store.wireKeyOf("ArmySlot", slot) ?? `${slot.game_id}:${slot.structure_id}:${slot.epoch}:${slot.slot}`,
      value: wire({
        ...slot,
        explorer_id: army.explorer_id,
        stamina: "Inline" in army.troops.stamina ? army.troops.stamina.Inline : store.require("ArmySlot", slot).stamina,
      }),
    },
    {
      model: "SliceRules",
      key: store.wireKeyOf("SliceRules", rules)!,
      value: wire({ ...rules, troop_stamina_config: { ...rules.troop_stamina_config, stamina_gain_per_tick: 0 } }),
    },
    {
      model: "ArmyProgress",
      key: store.wireKeyOf("ArmyProgress", key)!,
      value: wire({
        ...progress,
        oath_slots: 1,
        oaths: full ? 1 << (oaths.GIANTS - 1) : 0,
        oath_pick: fightOath - 1 + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8),
      }),
    },
  ]);
}

function answerChoice(command: LabCommand, chain: NativeFactStore): LabFact[] | null {
  if (command.kind !== "ChooseOath") return null;
  const fields = command.calldata.slice(5).map(Number);
  const explorer_id = fields.shift()!;
  const expected = fields.shift()!;
  const oath = fields.shift() === 0 ? fields.shift()! : null;
  const replace = fields.shift() === 0 ? fields.shift()! : null;
  if (fields.length) throw new Error("Extra Oath command fields");
  const current = chain.require("ArmyProgress", { game_id: 1, explorer_id });
  return [
    {
      model: "ArmyProgress",
      key: chain.wireKeyOf("ArmyProgress", current)!,
      value: wire(chooseOath(current, expected, oath, replace)),
    },
  ];
}

function answerDeletion(command: LabCommand, chain: NativeFactStore): LabFact[] | null {
  if (command.kind !== "ManageTroops") return null;
  const explorer_id = BigInt(command.calldata.at(-1)!);
  const encoded = encodeNativeCommand(nativeBindings.commandAbi, {
    kind: "ManageTroops",
    value: { kind: "RemoveExplorer", value: explorer_id },
  });
  const payload = command.calldata.slice(4);
  if (payload.length !== encoded.length || payload.some((field, index) => BigInt(field) !== BigInt(encoded[index]!)))
    return null;
  const key = { game_id: 1, explorer_id };
  chain.require("ExplorerTroops", key);
  chain.require("ArmyProgress", key);
  const slot = [...chain.entries("ArmySlot")].find(
    ([, row]) => row.game_id === key.game_id && row.explorer_id === explorer_id,
  );
  const tile = [...chain.entries("TileOccupancy")].find(
    ([, row]) => row.game_id === key.game_id && row.entity_id === explorer_id,
  );
  if (!slot || !tile) throw new Error("Deleted army has no slot or tile");
  return [
    ...(["ExplorerTroops", "ArmyProgress", "ArmyDay", "ArmyCombat"] as const).map((model) => ({
      model,
      key: chain.wireKeyOf(model, key)!,
      value: null,
    })),
    ...(["ResourceBalance", "ResourceProduction", "ResourceWeight"] as const).flatMap((model) =>
      [...chain.entries(model)]
        .filter(([, row]) => row.game_id === key.game_id && row.entity_id === explorer_id)
        .map(([key]) => ({ model, key, value: null })),
    ),
    { model: "TileOccupancy", key: tile[0], value: null },
    { model: "ArmySlot", key: slot[0], value: wire({ ...slot[1], explorer_id: 0 }) },
  ];
}
