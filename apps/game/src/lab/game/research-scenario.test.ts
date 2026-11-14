import { researchTier } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { expect, it } from "vitest";

import { chainOf, type LabCommand, type LabFact } from "./lab-chain";
import { researchScenario } from "./research-scenario";

const whole = (amount: number) => String(BigInt(amount) * BigInt(RESOURCE_PRECISION));
const command = (kind: string, fields: Record<string, string>): LabCommand => ({ kind, fields, calldata: [] });
const balance = (facts: LabFact[], resource: ResourcesIds) =>
  facts.find(
    ({ model, value }) =>
      model === "ResourceBalance" && (value as { resource_type: number }).resource_type === resource,
  )?.value as { balance: string } | undefined;
const held = (game: ReturnType<typeof researchScenario>, resource: ResourcesIds) =>
  game.store.get("ResourceBalance", { game_id: 1, entity_id: 7n, resource_type: resource })!.balance;

it("answers a deploy with a new army of the troops sent beside the realm, its troops and wheat paid", () => {
  const game = researchScenario();
  const wheat = held(game, ResourcesIds.Wheat);
  const chain = chainOf(game);
  const facts = game.answer(
    command("CreateExplorer", { structure_id: "7", slot: "1", category: "0", tier: "0", amount: whole(420), direction: "0" }),
    chain,
    game.startsAt + 30,
  );

  const army = facts.find(({ model }) => model === "ExplorerTroops")!.value as {
    explorer_id: string;
    owner: string;
    troops: { count: string };
  };
  expect([army.owner, army.troops.count]).toEqual(["7", whole(420)]);
  expect(army.troops).toMatchObject({ stamina: { Slot: 1 } });
  expect(facts.find(({ model }) => model === "ArmyDay")!.value).toMatchObject({ explorer_id: army.explorer_id, day: 0 });
  expect(facts.find(({ model }) => model === "ArmySlot")!.value).toMatchObject({ explorer_id: army.explorer_id, epoch: 0, slot: 1 });
  expect(facts.find(({ model }) => model === "ArmyProgress")!.value).toMatchObject({ explorer_id: army.explorer_id, xp: 0, common_points: 0 });
  const tile = facts.find(({ model }) => model === "TileOccupancy")!.value as { entity_id: string };
  expect(tile.entity_id).toBe(army.explorer_id);
  expect(balance(facts, ResourcesIds.Knight)?.balance).toBe("0");
  expect(BigInt(balance(facts, ResourcesIds.Wheat)!.balance)).toBe(wheat - BigInt(whole(840)));
  chain.applyFacts(facts as never);
  const slotKey = { game_id: 1, structure_id: 7n, epoch: 0n, slot: 1 };
  const before = chain.require("ArmySlot", slotKey).stamina.amount;
  const moved = game.answer(
    { kind: "Move", fields: {}, calldata: ["0", "0", "0", "0", "0", army.explorer_id, "1", "1"] },
    chain,
    game.startsAt + 31,
  );
  chain.applyFacts(moved as never);
  const cost = chain.require("SliceRules", { game_id: 1 }).troop_stamina_config.stamina_travel_stamina_cost;
  expect(chain.require("ArmySlot", slotKey).stamina.amount).toBe(before - BigInt(cost));
  expect(chain.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(army.explorer_id) }).troops.stamina).toEqual({ Slot: 1 });
});

it("answers a research with the row's next tier learned and its price paid", () => {
  const game = researchScenario();
  const essence = held(game, ResourcesIds.Essence);
  const facts = game.answer(
    command("Research", { structure_id: "7", row: String(research.ROW_SHRINE), choice: "0" }),
    chainOf(game),
    game.startsAt,
  );

  const knowledge = facts.find(({ model }) => model === "RealmKnowledge")!.value as { learned: string };
  expect(researchTier(BigInt(knowledge.learned), research.ROW_SHRINE)).toBe(1);
  expect(BigInt(balance(facts, ResourcesIds.Essence)!.balance)).toBe(essence - BigInt(whole(2_000)));
});
