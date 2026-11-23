import { dayAtIndex, readExpeditionRules } from "@bibliothecadao/eternum";
import { nativeBaneConstants, nativeRaceConstants } from "@bibliothecadao/eternum/game-client";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { chainOf, wire, type LabFact, type LabScenario } from "./lab-chain";
import { upkeepScenario } from "./upkeep-scenario";
import { raceRules } from "./race-scenario";

/** Day two's spent army under Mist Tide, with or without the Aspect's recorded Second Wind. */
export function staminaScenario(wind: boolean): LabScenario {
  const scenario = upkeepScenario();
  const store = chainOf(scenario);
  const calendar = readExpeditionRules(store, 1)!;
  const day = dayAtIndex(calendar, 1);
  const elapsed = day.start - calendar.startMainAt;
  const startsAt = scenario.startsAt + elapsed;
  const rowOffset = 4 * calendar.spacing;
  const facts: LabFact[] = [];
  const relocated: LabFact[] = [];
  for (const model of ["TileOpt", "TileOccupancy"] as const) {
    for (const [key, row] of store.entries(model)) {
      if (!row.alt) {
        relocated.push({ model, key, value: null });
        facts.push({ model, key, value: wire({ ...row, row: row.row + rowOffset }) });
      }
    }
  }
  for (const [key, row] of store.entries("ArmyDay"))
    facts.push({ model: "ArmyDay", key, value: wire({ ...row, day: 1 }) });
  for (const [key, row] of store.entries("ArmySlot")) {
    relocated.push({ model: "ArmySlot", key, value: null });
    facts.push({
      model: "ArmySlot",
      key,
      value: wire({
        ...row,
        epoch: 1,
        stamina: { ...row.stamina, settled_at: startsAt - 60 },
      }),
    });
  }
  const rules = store.require("SliceRules", { game_id: 1 });
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: SPIRE_ARMY });
  facts.push(
    {
      model: "SliceRules",
      key: store.wireKeyOf("SliceRules", { game_id: 1 })!,
      value: wire({
        ...rules,
        tick_config: { ...rules.tick_config, armies_tick_in_seconds: 60 },
        troop_stamina_config: { ...rules.troop_stamina_config, stamina_gain_per_tick: 20 },
      }),
    },
    {
      model: "HomeAspect",
      key: store.wireKeyOf("HomeAspect", { game_id: 1, home: army.owner }) ?? "0xd01",
      value: wire({ game_id: 1, home: army.owner, aspect: 1 }),
    },
    { model: "AspectActivity", key: "0xd02", value: { game_id: 1, aspect: 1, day: 0, active: 4 } },
    {
      model: "BaneRules",
      key: "0xd03",
      value: {
        game_id: 1,
        chance_step: 20,
        quorum_percent: 25,
        beast_percent: 150,
        stamina_percent: 50,
        production_percent: 50,
        quest_counts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10000, 15000],
      },
    },
    { model: "WorldBane", key: "0xd04", value: { game_id: 1, day: 1, kind: nativeBaneConstants.MIST_TIDE } },
    { model: "RaceRules", key: "0xd05", value: wire(raceRules()) },
  );
  if (wind)
    facts.push({
      model: "TriumphDay",
      key: "0xd06",
      value: {
        game_id: 1,
        aspect: 1,
        stage: nativeRaceConstants.SECOND_WIND_STAGE,
        day: 1,
      },
    });
  store.applyFacts(relocated as never);
  store.applyFacts(facts as never);
  store.setSnapshot({ gameId: 1, actor: scenario.player, complete: true, timestamp: startsAt });
  return {
    ...scenario,
    store,
    startsAt,
    opensOn: { ...scenario.opensOn, row: scenario.opensOn.row + rowOffset },
    startDevice: () => window.localStorage.setItem(`frontier.day-done.1.${scenario.player}`, "1"),
  };
}
