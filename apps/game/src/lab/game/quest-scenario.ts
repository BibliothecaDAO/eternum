import { readDailyQuest } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { nativeCommandBits } from "../../../../../contracts/l3/world-native/schema/commands.gen";
import { type LabScenario, wire } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** A completed quest on the real HUD; the lab supplies the contract's collection result. */
export function questScenario(): LabScenario {
  const scenario = spireScenario();
  const { store, startsAt } = scenario;
  const rules = store.require("SliceRules", { game_id: 1 });
  const counts = [1, 1, 1, 1, 1, 2, 15];
  store.applyFacts([
    {
      model: "SliceRules",
      key: "0x100",
      value: { ...rules, command_mask: rules.command_mask | BigInt(nativeCommandBits.ClaimDailyQuest) },
    },
    ...[...store.entries("LaborRules")].map(([key]) => ({ model: "LaborRules", key, value: null })),
    ...[...store.entries("SettledRealm")].map(([key]) => ({ model: "SettledRealm", key, value: null })),
    ...[...store.entries("CampaignHome")].map(([key]) => ({ model: "CampaignHome", key, value: null })),
    {
      model: "QuestRules",
      key: "0xa70",
      value: { game_id: 1, base_counts: counts, labor: 1000, essence: 1500, bonus_percent: 150 },
    },
    resource(store, ResourcesIds.Labor, 500n * BigInt(RESOURCE_PRECISION)),
    resource(store, ResourcesIds.Essence, 0n),
  ]);
  const today = readDailyQuest(store, 1, 7, startsAt)!;
  store.applyFacts([
    {
      model: "QuestProgress",
      key: "0xa71",
      value: {
        game_id: 1,
        home: 7,
        day: today.day,
        progress: counts[today.id],
        completed_level: 1,
      },
    },
  ]);
  return {
    ...scenario,
    answer: (command, chain, now) => {
      if (command.kind !== "ClaimDailyQuest") return scenario.answer(command, chain, now);
      const home = Number(command.fields.home);
      const day = Number(command.fields.day);
      const quest = readDailyQuest(chain, 1, home, now);
      if (home !== 7 || day !== quest?.day || !quest.reading.known?.completed)
        throw new Error("Quest is not collectible");
      if (quest.reading.known.claimed) return [];
      const { reward } = quest.reading.known;
      const amount = reward.labor * BigInt(RESOURCE_PRECISION);
      const essence = reward.essence * BigInt(RESOURCE_PRECISION);
      return [
        {
          model: "LaborGrant",
          key: "0xa72",
          value: wire({ game_id: 1, home, day, account: scenario.player, amount, essence }),
        },
        resource(
          chain,
          ResourcesIds.Labor,
          chain.require("ResourceBalance", { game_id: 1, entity_id: home, resource_type: ResourcesIds.Labor }).balance +
            amount,
        ),
        resource(
          chain,
          ResourcesIds.Essence,
          chain.require("ResourceBalance", { game_id: 1, entity_id: home, resource_type: ResourcesIds.Essence })
            .balance + essence,
        ),
      ];
    },
  };
}

function resource(store: LabScenario["store"], resource: ResourcesIds, balance: bigint) {
  const key = [...store.entries("ResourceBalance")].find(
    ([, row]) => row.entity_id === 7n && row.resource_type === resource,
  )?.[0];
  return {
    model: "ResourceBalance",
    key: key ?? `0xa8${resource.toString(16)}`,
    value: wire({ game_id: 1, entity_id: 7, resource_type: resource, balance }),
  };
}
