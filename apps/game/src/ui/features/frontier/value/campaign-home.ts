import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { DEVCON, campaignRealmMark } from "@/ui/design-system/kit/words";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { shortString } from "starknet";

/**
 * A campaign home: a realm founded with an event's ticket (CampaignHome, written once at founding), not with a Realm
 * its player holds. Its campaign is the identity Worker's key for it (apps/realms/server/campaigns.ts) as a short string,
 * its tier the contract's (settlement.cairo: CAMPAIGN_NORMAL 1, CAMPAIGN_GOLDEN 2).
 */
const CAMPAIGN_NAMES: Readonly<Record<string, string>> = { "devcon-2026": DEVCON };
const GOLDEN_TIER = 2;

export interface CampaignMark {
  /** What its realm wears beside its rank: "Devcon", "Golden Devcon". */
  line: string;
  golden: boolean;
}

/** A home founded with a golden campaign ticket. */
export const isGoldenHome = (home: NativeRows["CampaignHome"] | undefined) => home?.tier === GOLDEN_TIER;

/** The home's campaign, as its realm wears it; null for a home of no campaign. */
export const campaignMarkOf = (home: NativeRows["CampaignHome"] | undefined): CampaignMark | null => {
  if (!home) return null;
  const campaign = CAMPAIGN_NAMES[shortString.decodeShortString(`0x${home.campaign_id.toString(16)}`)];
  if (!campaign) {
    if (import.meta.env.DEV) throw new Error(`Campaign ${home.campaign_id} has no name in campaign-home.ts`);
    return null;
  }
  const golden = isGoldenHome(home);
  return { line: campaignRealmMark(campaign, golden), golden };
};

export const readCampaignHome = (store: Pick<NativeFactStore, "get">, realm: NativeRows["Structure"]) =>
  store.get("CampaignHome", { game_id: realm.game_id, home: realm.entity_id });

/** The realm's campaign mark, read again as the home's facts change. */
export const useCampaignMark = (realm: NativeRows["Structure"] | null): CampaignMark | null => {
  const { setup } = useGame();
  useNativeRevision(["CampaignHome"]);
  return realm ? campaignMarkOf(readCampaignHome(setup.store, realm)) : null;
};
