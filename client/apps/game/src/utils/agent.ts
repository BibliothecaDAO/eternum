import { ModelType } from "@/three/types/army.types";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { generatePersona } from "./generate_persona";

// Define agent models for clarity
const AGENT_YP_MODEL = ModelType.AgentYP;
const AGENT_ISTARAI_MODEL = ModelType.AgentIstarai;
const AGENT_APIX_MODEL = ModelType.AgentApix;
const AGENT_ELISA_MODEL = ModelType.AgentElisa;

// Define agent names
const AGENT_YP_NAME = "Agent YP";
const AGENT_ISTARAI_NAME = "Agent Istarai";
const AGENT_APIX_NAME = "Agent Apix";
const AGENT_ELISA_NAME = "Agent Elisa";

// Internal enum to represent special agent types
enum SpecialAgentType {
  None,
  YP,
  Istarai,
  Apix,
  Elisa,
}

// Total probability for any special agent to appear (e.g., 12 for 12%)
// This means if the roll is 0-11 (inclusive), a special agent is considered.
const SPECIAL_AGENT_ROLL_THRESHOLD = 75;

export const determineSpecialAgentType = (
  troopTier: TroopTier,
  troopType: TroopType,
  entityId: number,
): SpecialAgentType => {
  if (troopTier !== TroopTier.T3) return SpecialAgentType.None;

  const specialCharacterRoll = ((entityId * 9301 + 49297) % 233280) % 100;

  if (specialCharacterRoll < SPECIAL_AGENT_ROLL_THRESHOLD) {
    if (troopType === TroopType.Knight) {
      return SpecialAgentType.YP;
    }
    if (troopType === TroopType.Crossbowman) {
      return SpecialAgentType.Istarai;
    }
    // For Apix and Elisa, the original logic used half the threshold.
    // If roll is less than half (e.g. 0-5 for threshold 12), it's Apix.
    // Otherwise (e.g. 6-11), it's Elisa.
    if (specialCharacterRoll < SPECIAL_AGENT_ROLL_THRESHOLD / 2) {
      return SpecialAgentType.Apix;
    } else {
      return SpecialAgentType.Elisa;
    }
  }
  return SpecialAgentType.None;
};

export const getCharacterModel = (
  troopTier: TroopTier,
  troopType: TroopType,
  entityId: number,
): ModelType | undefined => {
  const agentType = determineSpecialAgentType(troopTier, troopType, entityId);

  switch (agentType) {
    case SpecialAgentType.YP:
      return AGENT_YP_MODEL;
    case SpecialAgentType.Istarai:
      return AGENT_ISTARAI_MODEL;
    case SpecialAgentType.Apix:
      return AGENT_APIX_MODEL;
    case SpecialAgentType.Elisa:
      return AGENT_ELISA_MODEL;
    case SpecialAgentType.None:
    default:
      return undefined;
  }
};

export const getCharacterName = (troopTier: TroopTier, troopType: TroopType, entityId: number): string | undefined => {
  const agentType = determineSpecialAgentType(troopTier, troopType, entityId);

  switch (agentType) {
    case SpecialAgentType.YP:
      return AGENT_YP_NAME;
    case SpecialAgentType.Istarai:
      return AGENT_ISTARAI_NAME;
    case SpecialAgentType.Apix:
      return AGENT_APIX_NAME;
    case SpecialAgentType.Elisa:
      return AGENT_ELISA_NAME;
    case SpecialAgentType.None:
    default:
      return generatePersona(entityId).name;
  }
};
