import { canonicalRealm } from "@bibliothecadao/eternum";
import { aspects, orders } from "@bibliothecadao/types";

import { frontierSeasonOnePreset } from "../../../../../config/source/frontier/season-one";
import { type LabScenario, wire } from "./lab-chain";
import { settleScenario } from "./settle-scenario";

/** The real founding screen and provider, with the contract's membership result supplied by the lab chain. */
export const aspectSettleScenario = (): LabScenario => {
  const scenario = settleScenario();
  scenario.store.applyFacts([
    { model: "AspectRules", key: "0xa50", value: { game_id: 1, orders: frontierSeasonOnePreset.orderAspects } },
  ]);
  return {
    ...scenario,
    answer: (command, chain, now) => {
      if (command.kind !== "SettleSeason") return scenario.answer(command, chain, now);
      const payload = command.calldata.slice(5).map(Number);
      if (payload.length !== 3 || payload[0] !== 1 || payload[1] !== 0)
        throw new Error("The free home needs an Aspect and no selected Realm");
      const aspect = aspects.find(({ id }) => id === payload[2]);
      if (!aspect) throw new Error("Choose an Aspect");
      const realmId = realmForAspect(aspect.id);
      const order = canonicalRealm(realmId).order;
      const founded = scenario.answer(command, chain, now).map((row) => {
        if (row.model !== "Structure") return row;
        const value = row.value as { entity_id: string; metadata: Record<string, unknown> };
        if (BigInt(value.entity_id) !== 7n) return row;
        return { ...row, value: { ...value, metadata: { ...value.metadata, realm_id: realmId, order } } };
      });
      return [
        ...founded,
        { model: "HomeAspect", key: "0xa51", value: wire({ game_id: 1, home: 7, aspect: aspect.id }) },
        { model: "AspectMembers", key: `0xa6${aspect.id}`, value: wire({ game_id: 1, aspect: aspect.id, members: 1 }) },
      ];
    },
  };
};

function realmForAspect(aspect: number): number {
  for (let realm = 1; realm <= 8_000; realm++) {
    if (orders.find(({ orderId }) => orderId === canonicalRealm(realm).order)?.aspect === aspect) return realm;
  }
  throw new Error(`No canonical Realm for Aspect ${aspect}`);
}
