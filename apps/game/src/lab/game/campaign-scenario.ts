import { BUILDINGS_CENTER, BuildingType } from "@bibliothecadao/types";
import { shortString } from "starknet";

import type { LabFact, LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";
import { realmScenario } from "./realm-scenario";

/**
 * The spire's game with realm 7 founded with a Devcon ticket (/lab/game?scenario=devcon, or devcon-golden): Frontier's
 * daily Labor, a golden ticket's Essence with it, and the campaign home the contract writes at founding, so the HUD's
 * realm panel and its daily claim can be seen as a Devcon player meets them.
 */
export const campaignScenario = (tier: "regular" | "golden", level?: number) => (): LabScenario => {
  const spire = level === undefined ? spireScenario() : realmScenario();
  spire.store.applyFacts(campaignHome(tier === "golden" ? 2 : 1) as never);
  if (level !== undefined) {
    const realm = spire.store.require("Structure", { game_id: 1, entity_id: 7 });
    const value = JSON.parse(
      JSON.stringify({ ...realm, base: { ...realm.base, level } }, (_, field) =>
        typeof field === "bigint" ? String(field) : field,
      ),
    );
    spire.store.applyFacts([
      { model: "Structure", key: "0x7", value },
      {
        model: "Building",
        key: "0x1ab89",
        value: {
          game_id: 1,
          structure_id: "7",
          inner_col: BUILDINGS_CENTER[0],
          inner_row: BUILDINGS_CENTER[1],
          category: BuildingType.ResourceLabor,
          paused: false,
          labor_paid: "0",
        },
      },
    ] as never);
  }
  return spire;
};

const campaignHome = (tier: number): LabFact[] => [
  { model: "LaborRules", key: "0x1abc0", value: { game_id: 1, amount: "1000", golden_essence: "1000" } },
  {
    model: "CampaignHome",
    key: "0x1abc1",
    value: { game_id: 1, home: 7, campaign_id: shortString.encodeShortString("devcon-2026"), tier },
  },
];
