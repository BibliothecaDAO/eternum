import type { NativeFactStore } from "../client/native-fact-store";

/** What one home's claim gives each game day; whole units, as the claim's button and its push both say them. */
export interface HomeDailyClaim {
  labor: number;
  essence: number;
}

/** A campaign home founded with a golden ticket (settlement.cairo: CAMPAIGN_GOLDEN 2), which claims the golden amounts. */
export const isGoldenCampaignHome = (home: { tier: number } | undefined): boolean => home?.tier === 2;

type ClaimFacts = Pick<NativeFactStore, "get">;

/**
 * The one reader of a home's daily claim, for the game's Realm sheet and the notifier's Day open push alike. A home
 * claims when it was founded with a held Realm (SettledRealm names it) or with a campaign's ticket (CampaignHome); any
 * other home has no claim (null). The game's LaborRules give the amounts.
 */
export const homeDailyClaim = (
  facts: ClaimFacts,
  home: { gameId: number; entityId: bigint | number; realmId: number },
): HomeDailyClaim | null => {
  const { gameId: game_id } = home;
  const entityId = BigInt(home.entityId);
  const rules = facts.get("LaborRules", { game_id });
  if (!rules) return null;
  const settled = facts.get("SettledRealm", { game_id, realm_id: home.realmId });
  const campaign = facts.get("CampaignHome", { game_id, home: entityId });
  if (settled?.home !== entityId && !campaign) return null;
  const golden = isGoldenCampaignHome(campaign);
  return {
    labor: Number(golden ? rules.golden_amount : rules.amount),
    essence: Number(golden ? rules.golden_essence : campaign ? rules.campaign_essence : 0),
  };
};
