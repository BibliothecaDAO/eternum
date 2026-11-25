import { resolveExplorerTroops, staminaAt } from "@bibliothecadao/eternum/troop-stamina";
import { seasonOneResearchPrices } from "./season-one-research";
import {
  armyEtherealLayer,
  chooseOath,
  DEEP_DEPTH,
  heldOaths,
  oathCards,
  oathPassStamina,
  rerollOath,
} from "@bibliothecadao/eternum";
import {
  nativeFragmentConstants,
  nativeOathConstants as oaths,
  nativeResearchConstants as research,
} from "@bibliothecadao/eternum/game-client";
import { encodeNativeCommand } from "@bibliothecadao/provider";
import type { TroopType } from "@bibliothecadao/types";
import { nativeBindings } from "@/runtime/world/native-bindings";
import { currentArmy, currentResourceWeight, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { spireScenario } from "./spire-scenario";
import { wire, type LabCommand, type LabFact, type LabScenario } from "./lab-chain";
import { fragmentsSpent, holdFragments } from "./shop-scenario";

const FRAGMENTS_HELD = 100n;

export function oathPickScenario(
  full = false,
  game = spireScenario(),
  fightOath: number = oaths.POWER,
  category?: TroopType,
): LabScenario {
  prepareOathArmy(game.store, full, fightOath, category);
  holdFragments(game.store, game.player, FRAGMENTS_HELD);
  return {
    ...game,
    answer: (command, chain, now) =>
      answerDeletion(command, chain) ??
      answerChoice(command, chain, now) ??
      answerReroll(command, chain, game.player) ??
      game.answer(command, chain, now),
  };
}

export function oathPassCappedScenario(): LabScenario {
  const game = oathPickScenario(true);
  const army = game.store.require("ExplorerTroops", { game_id: 1, explorer_id: SPIRE_ARMY });
  const troops = resolveExplorerTroops(game.store, army, game.startsAt);
  if (!troops || troops.staminaMax === undefined || !("Slot" in army.troops.stamina))
    throw new Error("Missing pass fixture stamina");
  const day = game.store.require("ArmyDay", army);
  const slot = game.store.require("ArmySlot", {
    game_id: 1,
    structure_id: army.owner,
    epoch: day.day,
    slot: army.troops.stamina.Slot,
  });
  game.store.applyFacts([
    {
      model: "ArmySlot",
      key: game.store.wireKeyOf("ArmySlot", slot)!,
      value: wire({ ...slot, stamina: { ...slot.stamina, amount: troops.staminaMax - oaths.PASS_STAMINA / 2 } }),
    },
  ]);
  return game;
}

function prepareOathArmy(store: NativeFactStore, full: boolean, fightOath: number, category?: TroopType) {
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
      value: wire({
        ...army,
        troops: { ...army.troops, category: category ?? army.troops.category, stamina: { Slot: slot.slot } },
      }),
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
        oath_slots: research.OATH_SLOTS_BASE,
        oaths: full ? heldSet(research.OATH_SLOTS_BASE) : 0,
        oath_pick: fightOath - 1 + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8),
      }),
    },
  ]);
}

function heldSet(count: number): number {
  return [oaths.GIANTS, oaths.SKILL, oaths.PERFECTION]
    .slice(0, count)
    .reduce((mask, oath) => mask | (1 << (oath - 1)), 0);
}

function answerChoice(command: LabCommand, chain: NativeFactStore, now: number): LabFact[] | null {
  if (command.kind !== "ChooseOath") return null;
  const fields = command.span.slice(1).map(Number);
  const explorer_id = fields.shift()!;
  const expected = fields.shift()!;
  const oath = fields.shift() === 0 ? fields.shift()! : null;
  const replace = fields.shift() === 0 ? fields.shift()! : null;
  if (fields.length) throw new Error("Extra Oath command fields");
  const current = chain.require("ArmyProgress", { game_id: 1, explorer_id });
  const chosen = chooseOath(current, expected, oath, replace);
  return [
    ...settleDeepChoice(chain, explorer_id, now),
    ...(oath === null ? passStamina(chain, explorer_id, now) : []),
    {
      model: "ArmyProgress",
      key: chain.wireKeyOf("ArmyProgress", current)!,
      value: wire(chosen),
    },
  ];
}

function answerReroll(command: LabCommand, chain: NativeFactStore, player: string): LabFact[] | null {
  if (command.kind !== "RerollOath") return null;
  const [explorer_id, expected, index, ...extra] = command.span.slice(1).map(Number);
  if (extra.length) throw new Error("Extra Oath reroll fields");
  if (armyEtherealLayer(chain, 1, explorer_id!) === DEEP_DEPTH) throw new Error("no oath is rerolled in the Deep");
  const current = chain.require("ArmyProgress", { game_id: 1, explorer_id: explorer_id! });
  const unseen = [...heldOaths(current.oaths), ...oathCards(expected!)];
  const oath = Array.from({ length: 16 }, (_, at) => at + 1).find((id) => !unseen.includes(id));
  if (oath === undefined) throw new Error("No Oath left to reroll");
  return [
    {
      model: "ArmyProgress",
      key: chain.wireKeyOf("ArmyProgress", current)!,
      value: wire(rerollOath(current, expected!, index!, oath)),
    },
    fragmentsSpent(chain, player, BigInt(nativeFragmentConstants.OATH_REROLL_FRAGMENTS)),
  ];
}

function passStamina(chain: NativeFactStore, explorer_id: number, now: number): LabFact[] {
  const key = { game_id: 1, explorer_id };
  const army = chain.require("ExplorerTroops", key);
  if (!("Slot" in army.troops.stamina)) throw new Error("Oath army must have a slot");
  const troops = resolveExplorerTroops(chain, army, now);
  if (!troops || troops.staminaMax === undefined) throw new Error("Missing Oath army stamina");
  const rules = chain.require("SliceRules", { game_id: key.game_id });
  const bar = staminaAt(troops, now, rules.troop_stamina_config, Number(rules.tick_config.armies_tick_in_seconds));
  const amount = oathPassStamina(Number(bar.amount), troops.staminaMax);
  const day = chain.require("ArmyDay", key);
  const slot = chain.require("ArmySlot", {
    game_id: key.game_id,
    structure_id: army.owner,
    epoch: day.day,
    slot: army.troops.stamina.Slot,
  });
  return [
    {
      model: "ArmySlot",
      key: chain.wireKeyOf("ArmySlot", slot)!,
      value: wire({
        ...slot,
        stamina: { amount, settled_at: now, remainder: amount === troops.staminaMax ? 0 : bar.remainder },
      }),
    },
  ];
}

function answerDeletion(command: LabCommand, chain: NativeFactStore): LabFact[] | null {
  if (command.kind !== "ManageTroops") return null;
  const explorer_id = BigInt(command.span.at(-1)!);
  const encoded = encodeNativeCommand(nativeBindings.commandAbi, {
    kind: "ManageTroops",
    value: { kind: "RemoveExplorer", value: explorer_id },
  });
  const payload = command.span;
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

function settleDeepChoice(chain: NativeFactStore, explorer_id: number, now: number): LabFact[] {
  const key = { game_id: 1, explorer_id };
  const deep = chain.get("DeepArmy", key);
  if (!deep) return [];
  const source = chain.require("ExplorerTroops", key);
  const army = currentArmy(chain, source, now);
  const rules = chain.require("SliceRules", { game_id: key.game_id });
  const weight = chain.get("ResourceWeight", { game_id: key.game_id, entity_id: explorer_id });
  return [
    { model: "ExplorerTroops", key: chain.wireKeyOf("ExplorerTroops", key)!, value: wire(army) },
    {
      model: "DeepArmy",
      key: chain.wireKeyOf("DeepArmy", key)!,
      value: wire({ ...deep, last_tick: Math.floor(now / Number(rules.tick_config.armies_tick_in_seconds)) }),
    },
    ...(weight
      ? [
          {
            model: "ResourceWeight",
            key: chain.wireKeyOf("ResourceWeight", weight)!,
            value: wire(currentResourceWeight(chain, weight, now)),
          },
        ]
      : []),
  ];
}
