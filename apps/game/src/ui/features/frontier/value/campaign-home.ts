import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { DEVCON, campaignRealmMark } from "@/ui/design-system/kit/words";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";

/**
 * A campaign home: a realm founded with an event's ticket (CampaignHome, written once at founding), not with a Realm
 * its player holds. Its campaign is the identity Worker's number for it (apps/realms/server/campaigns.ts), its tier the
 * contract's (settlement.cairo: CAMPAIGN_NORMAL 1, CAMPAIGN_GOLDEN 2).
 */
const CAMPAIGN_NAMES: Readonly<Record<string, string>> = { "1": DEVCON };
const GOLDEN_TIER = 2;

export interface CampaignMark {
  /** What its realm wears beside its rank: "Devcon", "Golden Devcon". */
  line: string;
  golden: boolean;
}

/** A golden ticket's home, which claims Essence with its Labor. */
export const isGoldenHome = (home: NativeRows["CampaignHome"] | undefined) => home?.tier === GOLDEN_TIER;

/** The home's campaign, as its realm wears it; null for a home of no campaign. */
export const campaignMarkOf = (home: NativeRows["CampaignHome"] | undefined): CampaignMark | null => {
  if (!home) return null;
  const campaign = CAMPAIGN_NAMES[String(home.campaign_id)];
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
