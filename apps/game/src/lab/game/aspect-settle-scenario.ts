import { canonicalRealm } from "@bibliothecadao/eternum";
import { orders, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

import frontierConfig from "../../../../../config/generated/frontier.madara.json";
import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { LAB_GAME, type LabScenario, wire } from "./lab-chain";
import { frontierCombatRules } from "../../ui/features/frontier/sites/site-fixture";
import { startingHomeFacts } from "./starting-home-facts";
import { settleScenario } from "./settle-scenario";

/** The real founding screen and provider, with the contract's membership result supplied by the lab chain. */
export const aspectSettleScenario = (): LabScenario => {
  const scenario = settleScenario();
  const laborKey = { game_id: 1, resource_type: ResourcesIds.Labor };
  const labor = scenario.store.require("ResourceRule", laborKey);
  const laborRate = BigInt(
    Math.round(
      frontierConfig.configuration.resources.productionByComplexRecipeOutputs[ResourcesIds.Labor] * RESOURCE_PRECISION,
    ),
  );
  scenario.store.applyFacts([
    {
      model: "ResourceRule",
      key: scenario.store.wireKeyOf("ResourceRule", laborKey)!,
      value: wire({ ...labor, realm_rate: laborRate, village_rate: laborRate / 2n }),
    },
    {
      model: "SliceRules",
      key: scenario.store.wireKeyOf("SliceRules", { game_id: 1 })!,
      value: { ...(wire(scenario.store.require("SliceRules", { game_id: 1 })) as object), ...frontierCombatRules() },
    },
    { model: "AspectRules", key: "0xa50", value: { game_id: 1, orders: frontierSeasonOnePreset.orderAspects } },
  ]);
  return {
    ...scenario,
    answer: (command, chain, now) => {
      if (command.kind !== "SettleSeason") return scenario.answer(command, chain, now);
      const payload = command.span.slice(1).map(Number);
      if (payload.length !== 3 || payload[0] !== 1 || payload[1] !== 0)
        throw new Error("The free home needs an Order and no selected Realm");
      const chosen = orders.find(({ orderId }) => orderId === payload[2]);
      if (!chosen?.aspect) throw new Error("Choose an Order of an Aspect");
      const aspect = chosen.aspect;
      const realmId = realmOfOrder(chosen.orderId);
      const order = chosen.orderId;
      const founded = startingHomeFacts(scenario.answer(command, chain, now), chain, now).map((row) => {
        if (row.model !== "Structure") return row;
        const value = row.value as { entity_id: string; metadata: Record<string, unknown> };
        if (BigInt(value.entity_id) !== 7n) return row;
        return { ...row, value: { ...value, metadata: { ...value.metadata, realm_id: realmId, order } } };
      });
      return [
        ...founded,
        {
          model: "AspectActivity",
          key: `0xa7${aspect}`,
          value: wire({ game_id: 1, aspect, day: 0, active: 1 }),
        },
        { model: "HomeAspect", key: "0xa51", value: wire({ game_id: 1, home: 7, aspect }) },
        { model: "AspectMembers", key: `0xa6${aspect}`, value: wire({ game_id: 1, aspect, members: 1 }) },
      ];
    },
  };
};

function realmOfOrder(order: number): number {
  for (let realm = 1; realm <= 8_000; realm++) {
    if (canonicalRealm(realm).order === order) return realm;
  }
  throw new Error(`No canonical Realm of Order ${order}`);
}

export const aspectSettleInvitedScenario = (): LabScenario => ({
  ...aspectSettleScenario(),
  joined: { kind: "aspect", chainId: LAB_GAME.chainId, gameId: LAB_GAME.gameId, moment: 2, name: "Linden" },
});
