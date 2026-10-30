import type { NativeFactStore } from "../client/native-fact-store";

/** What one home's claim gives each game day; whole units, as the claim's button and its push both say them. */
export interface HomeDailyClaim {
  labor: number;
  essence: number;
}

/** A campaign home founded with a golden ticket (settlement.cairo: CAMPAIGN_GOLDEN 2), which claims the golden amounts. */
export const isGoldenCampaignHome = (home: { tier: number } | undefined): boolean => home?.tier === 2;

type ClaimFacts = Pick<NativeFactStore, "get">;

/** The amounts in a game's LaborRules row, as its fact holds them or as a preset writes them there. */
export interface LaborRuleAmounts {
  amount: bigint | number | string;
  campaign_essence: bigint | number | string;
  golden_amount: bigint | number | string;
  golden_essence: bigint | number | string;
}

/** What a campaign home claims each game day: the campaign's amounts, or the golden ones for a golden ticket. */
export const campaignHomeClaim = (rules: LaborRuleAmounts, golden: boolean): HomeDailyClaim => ({
  labor: Number(golden ? rules.golden_amount : rules.amount),
  essence: Number(golden ? rules.golden_essence : rules.campaign_essence),
});

/**
 * Where a home's claim comes from, as the value relay registers it before the home is founded
 * (apps/value-relay/src/realm-entry.ts): a held Realm, a campaign's ticket, or nothing (a free home).
 */
export type HomeClaimSource = { kind: "realm" } | { kind: "campaign"; golden: boolean } | { kind: "free" };

/** What a home from this source claims each game day by the game's LaborRules: a held Realm its Labor, a free home none. */
export const homeSourceClaim = (rules: LaborRuleAmounts, source: HomeClaimSource): HomeDailyClaim | null => {
  if (source.kind === "campaign") return campaignHomeClaim(rules, source.golden);
  if (source.kind === "realm") return { labor: Number(rules.amount), essence: 0 };
  return null;
};

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
  if (campaign) return homeSourceClaim(rules, { kind: "campaign", golden: isGoldenCampaignHome(campaign) });
  return homeSourceClaim(rules, settled?.home === entityId ? { kind: "realm" } : { kind: "free" });
};
