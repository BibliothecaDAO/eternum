import { shortString } from "starknet";
import { DEVCON, DEVCON_LABOR_RULES } from "@/shell/join/devcon";

import type { LabFact, LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/**
 * The spire's game with realm 7 founded with a Devcon ticket (/lab/game?scenario=devcon, or devcon-golden): Frontier's
 * daily Labor and Essence, doubled for a golden ticket, and the campaign home the contract writes at founding, so the HUD's
 * realm panel and its daily claim can be seen as a Devcon player meets them.
 */
export const campaignScenario = (tier: "regular" | "golden") => (): LabScenario => {
  const spire = spireScenario();
  spire.store.applyFacts(campaignHomeFacts(tier) as never);
  return spire;
};

/** The facts the contract writes for realm 7 founded with a Devcon ticket: the game's LaborRules and its CampaignHome. */
export const campaignHomeFacts = (ticket: "regular" | "golden"): LabFact[] => [
  {
    model: "LaborRules",
    key: "0x1abc0",
    value: {
      game_id: 1,
      ...Object.fromEntries(Object.entries(DEVCON_LABOR_RULES).map(([key, value]) => [key, String(value)])),
    },
  },
  {
    model: "CampaignHome",
    key: "0x1abc1",
    value: {
      game_id: 1,
      home: 7,
      campaign_id: shortString.encodeShortString(DEVCON.campaign),
      tier: ticket === "golden" ? 2 : 1,
    },
  },
];
