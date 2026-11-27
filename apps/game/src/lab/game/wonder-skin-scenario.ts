import { devconHoldingOf, devCosmeticsUnlocked, holdsRealmSkin, holdsWonder } from "@bibliothecadao/eternum";

import { type LabScenario, wire } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

const HOME = { game_id: 1, entity_id: 7 };

export const wonderSkinScenario = (): LabScenario => {
  const scenario = spireScenario();
  const realm = scenario.store.require("Structure", HOME);
  scenario.store.applyFacts([
    {
      model: "Structure",
      key: scenario.store.wireKeyOf("Structure", HOME)!,
      value: wire({ ...realm, metadata: { ...realm.metadata, has_wonder: true } }),
    },
    { model: "HomeAspect", key: "0x5c11", value: wire({ game_id: HOME.game_id, home: HOME.entity_id, aspect: 3 }) },
  ]);
  return {
    ...scenario,
    entersFromHome: true,
    answer: (command, chain, now) => {
      if (command.kind !== "SetRealmSkin") return scenario.answer(command, chain, now);
      const entity_id = Number(command.fields.entity_id);
      const family = Number(command.fields.family);
      const home = chain.require("Structure", { game_id: 1, entity_id });
      if (BigInt(home.owner) !== BigInt(scenario.player)) throw new Error("actor does not own realm");
      const holding = {
        sealHeld: chain.get("Seal", { game_id: 1, account: home.owner }) !== undefined,
        aspect: chain.get("HomeAspect", { game_id: 1, home: home.entity_id })?.aspect ?? null,
        hasWonder: holdsWonder(home),
        ...devconHoldingOf(home.owner),
        devUnlocked: devCosmeticsUnlocked(chain.get("GameRegistry", { game_id: 1 })),
      };
      if (!holdsRealmSkin(holding, family)) throw new Error("realm skin not held");
      return [{ model: "RealmSkin", key: "0x5c10", value: wire({ game_id: 1, entity_id, family }) }];
    },
  };
};
