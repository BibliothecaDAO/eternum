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
  const facts = game.answer(
    command("CreateExplorer", { structure_id: "7", category: "0", tier: "0", amount: whole(420), direction: "0" }),
    chainOf(game),
    game.startsAt + 30,
  );

  const army = facts.find(({ model }) => model === "ExplorerTroops")!.value as {
    explorer_id: string;
    owner: string;
    troops: { count: string };
  };
  expect([army.owner, army.troops.count]).toEqual(["7", whole(420)]);
  const tile = facts.find(({ model }) => model === "TileOccupancy")!.value as { entity_id: string };
  expect(tile.entity_id).toBe(army.explorer_id);
  expect(balance(facts, ResourcesIds.Knight)?.balance).toBe("0");
  expect(BigInt(balance(facts, ResourcesIds.Wheat)!.balance)).toBe(wheat - BigInt(whole(840)));
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
