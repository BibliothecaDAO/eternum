import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

import { wire, type LabFact, type LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** A Realm's labor a day, as Frontier grants it. */
const LABOR_PER_REALM = 1_000;
/** Realm 7's labor before its claim: room in its store for the claim's. */
const LABOR_HELD = 500n * BigInt(RESOURCE_PRECISION);
/** The wallet the lab player's account has linked, which holds the Realms they claim with. */
const LINKED_WALLET = "0x456";

/**
 * The spire's game with Realm labor on (/lab/game?scenario=claim): a Realm's day of labor, realm 7 with room for it,
 * and its home settled with a held Realm, so the Realms sheet offers a claim. Its claims go to the value relay, which the lab answers in
 * the tab (lab-chain.ts, answerLaborClaims).
 */
export const claimScenario = (): LabScenario => {
  const spire = spireScenario();
  const home = spire.store.require("Structure", { game_id: 1, entity_id: 7n });
  spire.store.applyFacts([
    laborRules(),
    laborHeld(spire.store),
    {
      model: "SettledRealm",
      key: "0x1b32",
      value: wire({ game_id: 1, realm_id: home.metadata.realm_id, home: 7n }),
    },
  ] as never);
  return { ...spire, wallet: LINKED_WALLET };
};

const laborRules = (): LabFact => ({
  model: "LaborRules",
  key: "0x1b30",
  value: {
    game_id: 1,
    amount: String(LABOR_PER_REALM),
    campaign_essence: "1000",
    golden_amount: "2000",
    golden_essence: "2000",
  },
});

/** Realm 7's labor, under the key its balance is held by when it has one. */
const laborHeld = (store: NativeFactStore): LabFact => {
  const held = [...store.entries("ResourceBalance")].find(
    ([, row]) => row.entity_id === 7n && row.resource_type === ResourcesIds.Labor,
  );
  return {
    model: "ResourceBalance",
    key: held?.[0] ?? "0x1b31",
    value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Labor, balance: String(LABOR_HELD) },
  };
};
