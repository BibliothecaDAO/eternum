import {
  dayOf,
  entityHomeNamespace,
  expeditionRealmSite,
  readDailyQuest,
  readExpeditionRules,
} from "@bibliothecadao/eternum";
import { nativeBaneConstants, nativeQuestConstants } from "@bibliothecadao/eternum/game-client";
import { BiomeType, getHexesWithinRadius, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { type LabFact, type LabScenario, wire } from "./lab-chain";
import { withoutArmies } from "./day-turn-scenario";
import { questScenario } from "./quest-scenario";
import { revealedTile } from "./spire-scenario";

type BaneCase = "world" | "again" | "late" | "team";

/** Day 1 with the confirmed result of the home's quest; collection still goes through the real provider and HUD. */
export function baneScenario(stage: BaneCase): LabScenario {
  const scenario = questScenario();
  const store = withoutArmies(scenario.store);
  const calendar = readExpeditionRules(store, 1)!;
  const start = dayOf(calendar, calendar.startMainAt)!.end;
  const startsAt = start + 60;
  const home = store.require("Structure", { game_id: 1, entity_id: 7 });
  const opensOn = expeditionRealmSite(calendar, entityHomeNamespace(home.entity_id), startsAt)!;
  const ended = stage === "again" || stage === "late";
  const received = stage === "again";
  store.applyFacts([
    { model: "HomeAspect", key: "0xb01", value: { game_id: 1, home: 7, aspect: 2 } },
    { model: "AspectActivity", key: "0xb02", value: { game_id: 1, aspect: 2, day: 0, active: 5 } },
    {
      model: "BaneRules",
      key: "0xb03",
      value: {
        game_id: 1,
        chance_step: 20,
        quorum_percent: 40,
        beast_percent: 150,
        stamina_percent: 50,
        production_percent: 50,
        quest_counts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10_000, 15_000],
      },
    },
    { model: "WorldBane", key: "0xb04", value: { game_id: 1, day: 0, kind: 0 } },
    {
      model: "WorldBane",
      key: "0xb05",
      value: { game_id: 1, day: 1, kind: stage === "team" ? 0 : nativeBaneConstants.ASH_FALL },
    },
    {
      model: "QuestProgress",
      key: "0xb06",
      value: {
        game_id: 1,
        home: 7,
        day: 1,
        progress: stage === "team" ? 3 : 2500,
        completed_level: 1,
      },
    },
    {
      model: "BaneProgress",
      key: "0xb07",
      value: {
        game_id: 1,
        aspect: 2,
        day: 1,
        completed: ended ? 2 : 1,
        ended_at: ended ? start + 1 : 0,
      },
    },
    ...(received
      ? [receipt("LaborGrant", scenario.player, 1000n * BigInt(RESOURCE_PRECISION), 1500n * BigInt(RESOURCE_PRECISION))]
      : []),
    ...(stage === "team"
      ? [
          { model: "FirstTeamBane", key: "0xb08", value: { game_id: 1, issued_day: 0 } },
          {
            model: "TeamBane",
            key: "0xb09",
            value: {
              game_id: 1,
              aspect: 2,
              day: 1,
              source: 1,
              issued_day: 0,
              quest: nativeQuestConstants.STAND,
            },
          },
        ]
      : []),
    resource(store, ResourcesIds.Labor, (received ? 1500n : 500n) * BigInt(RESOURCE_PRECISION)),
    resource(store, ResourcesIds.Essence, (received ? 1500n : 0n) * BigInt(RESOURCE_PRECISION)),
    ...getHexesWithinRadius(opensOn.col, opensOn.row, 4)
      .filter((hex) => !store.get("TileOpt", { game_id: 1, alt: false, col: hex.col, row: hex.row }))
      .map((hex, index) =>
        revealedTile(`0xb10${index.toString(16)}`, { col: hex.col, row: hex.row }, BiomeType.Grassland),
      ),
  ]);
  store.setSnapshot({ gameId: 1, complete: true, actor: scenario.player, timestamp: startsAt });
  return {
    ...scenario,
    store,
    startsAt,
    opensOn,
    startDevice: () => window.localStorage.setItem(`frontier.day-done.1.${scenario.player}`, "1"),
    answer: (command, chain, now) => {
      if (command.kind !== "ClaimDailyQuest") return scenario.answer(command, chain, now);
      const today = readDailyQuest(chain, 1, 7, now);
      const reading = today?.reading.known;
      if (command.fields.home !== "7" || Number(command.fields.day) !== today?.day || !reading)
        throw new Error("Unknown quest collection");
      if (reading.state === "collected") return [];
      if (reading.state !== "done" && reading.state !== "again") throw new Error("Quest is not complete");
      const won = reading.bane?.type === "world" && reading.bane.endedAt !== 0 && reading.bane.endedAt <= now;
      const models: ("LaborGrant" | "BaneGrant")[] = [
        ...(!reading.receipts.ordinary ? ["LaborGrant" as const] : []),
        ...(won && !reading.receipts.bonus ? ["BaneGrant" as const] : []),
      ];
      const { labor, essence } = reading.reward;
      return [
        ...models.map((model) =>
          receipt(model, scenario.player, labor / BigInt(models.length), essence / BigInt(models.length)),
        ),
        resource(chain, ResourcesIds.Labor, balance(chain, ResourcesIds.Labor) + labor),
        resource(chain, ResourcesIds.Essence, balance(chain, ResourcesIds.Essence) + essence),
      ];
    },
  };
}

function receipt(model: "LaborGrant" | "BaneGrant", account: string, labor: bigint, essence: bigint): LabFact {
  return {
    model,
    key: model === "LaborGrant" ? "0xb20" : "0xb21",
    value: wire({
      game_id: 1,
      home: 7,
      day: 1,
      account,
      amount: labor,
      essence,
    }),
  };
}
function balance(store: LabScenario["store"], resource: ResourcesIds) {
  return store.require("ResourceBalance", { game_id: 1, entity_id: 7, resource_type: resource }).balance;
}
function resource(store: LabScenario["store"], resource: ResourcesIds, amount: bigint): LabFact {
  const keys = { game_id: 1, entity_id: 7, resource_type: resource };
  return {
    model: "ResourceBalance",
    key: store.wireKeyOf("ResourceBalance", keys)!,
    value: wire({ ...keys, balance: amount }),
  };
}
