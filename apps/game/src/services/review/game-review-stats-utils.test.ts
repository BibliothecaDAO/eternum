// @vitest-environment node
import { expect, it } from "vitest";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION, StructureType } from "@bibliothecadao/types";
import { buildGameReviewDerivedMetrics, readBattleLosses } from "./game-review-stats-utils";

const ATTACKER = "0xa1";
const DEFENDER = "0xd2";
const history = (model: string, value: Record<string, unknown>, index = 0): HeraldHistoryEvent => ({
  block_number: 10,
  event_index: index,
  game_id: "7",
  model,
  transaction_hash: "0x1",
  transaction_index: 0,
  value,
});

// A BattleEvent as Herald's history returns it: each side's troops before and after the fight.
const battle = history("BattleEvent", {
  attacker_id: 11,
  defender_id: 22,
  winner_id: 1,
  attacker: {
    player: ATTACKER,
    category: "Knight",
    tier: "T1",
    before: String(30 * RESOURCE_PRECISION),
    after: String(25 * RESOURCE_PRECISION),
    roll: 0,
  },
  defender: {
    player: DEFENDER,
    category: "Paladin",
    tier: "T1",
    before: String(20 * RESOURCE_PRECISION),
    after: "0",
    roll: 0,
  },
  timestamp: "0x3e8",
});

it("counts a native battle's losses in the post-game stats", () => {
  expect(readBattleLosses(battle)).toEqual({
    attacker: ATTACKER,
    defender: DEFENDER,
    attackerLost: 5,
    defenderLost: 20,
  });
  const metrics = buildGameReviewDerivedMetrics({ gameStartAt: 900, storyEvents: [battle], structures: [] });
  expect(metrics.mostTroopsKilled).toEqual({ playerAddress: ATTACKER, value: 20 });
});

it("names the first hyperstructure taken from its capture story and the structure's category", () => {
  const capture = history(
    "StoryEvent",
    {
      entity_id: 33,
      timestamp: "0x44c",
      story: { StructureCapturedStory: { previous_owner: "0x0", new_owner: DEFENDER, points: "0" } },
    },
    1,
  );
  const structures = [
    { entity_id: 33, owner: DEFENDER, base: { category: StructureType.Hyperstructure } },
    { entity_id: 44, owner: ATTACKER, base: { category: StructureType.Realm } },
  ];
  const metrics = buildGameReviewDerivedMetrics({ gameStartAt: 900, storyEvents: [battle, capture], structures });
  expect(metrics.timeToFirstHyperstructureSeconds).toEqual({ playerAddress: DEFENDER, timestamp: 1100, value: 200 });
  const realmCapture = history("StoryEvent", { ...capture.value, entity_id: 44 }, 2);
  expect(
    buildGameReviewDerivedMetrics({ gameStartAt: 900, storyEvents: [realmCapture], structures })
      .timeToFirstHyperstructureSeconds,
  ).toBeNull();
});
