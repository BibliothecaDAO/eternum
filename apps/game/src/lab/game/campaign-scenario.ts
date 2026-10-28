import { shortString } from "starknet";
import { DEVCON } from "@/shell/join/devcon";

import type { LabFact, LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/**
 * The spire's game with realm 7 founded with a Devcon ticket (/lab/game?scenario=devcon, or devcon-golden): Frontier's
 * daily Labor and Essence, doubled for a golden ticket, and the campaign home the contract writes at founding, so the HUD's
 * realm panel and its daily claim can be seen as a Devcon player meets them.
 */
export const campaignScenario = (tier: "regular" | "golden") => (): LabScenario => {
  const spire = spireScenario();
  spire.store.applyFacts(campaignHome(tier === "golden" ? 2 : 1) as never);
  return spire;
};

const campaignHome = (tier: number): LabFact[] => [
  {
    model: "LaborRules",
    key: "0x1abc0",
    value: {
      game_id: 1,
      amount: String(DEVCON.laborPerDay),
      campaign_essence: String(DEVCON.essencePerDay),
      golden_amount: String(DEVCON.goldenLaborPerDay),
      golden_essence: String(DEVCON.goldenEssencePerDay),
    },
  },
  {
    model: "CampaignHome",
    key: "0x1abc1",
    value: { game_id: 1, home: 7, campaign_id: shortString.encodeShortString(DEVCON.campaign), tier },
  },
];
