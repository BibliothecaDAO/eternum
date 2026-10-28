import { shortString } from "starknet";

import type { LabFact, LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/**
 * The spire's game with realm 7 founded with a Devcon ticket (/lab/game?scenario=devcon, or devcon-golden): Frontier's
 * daily Labor, a golden ticket's Essence with it, and the campaign home the contract writes at founding, so the HUD's
 * realm panel and its daily claim can be seen as a Devcon player meets them.
 */
export const campaignScenario = (tier: "regular" | "golden") => (): LabScenario => {
  const spire = spireScenario();
  spire.store.applyFacts(campaignHome(tier === "golden" ? 2 : 1) as never);
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
