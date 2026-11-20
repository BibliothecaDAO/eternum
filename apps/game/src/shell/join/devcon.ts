import type { LaborRuleAmounts } from "@bibliothecadao/eternum";
import type { CampaignKey } from "@realms-world/identity";

import { laborRulesOf } from "@/services/home-claim-rules";
import { frontierDevconPreset } from "../../../../../config/source/frontier/devcon";

/** The Devcon preset's LaborRules row, as the deployer writes it onchain for the Devcon season's games. */
export const DEVCON_LABOR_RULES: LaborRuleAmounts = laborRulesOf(frontierDevconPreset.labor);

export const DEVCON = { campaign: "devcon-2026" satisfies CampaignKey } as const;
