import { isGoldenCampaignHome } from "@bibliothecadao/eternum";
import { realmSkinOf, realmSkinIcon, REALM_SKINS } from "@/three/structures/realm-skins";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";

/**
 * A campaign home: a realm founded with an event's ticket (CampaignHome, written once at founding), not with a Realm
 * its player holds. Its campaign is the identity Worker's key for it (apps/realms/server/campaigns.ts) as a short string,
 * its tier the contract's (isGoldenCampaignHome).
 */

export interface CampaignMark {
  /** What its realm wears beside its rank: "Devcon", "Golden Devcon". */
  line: string;
  golden: boolean;
  icon: IconMeaning;
}

/** The home's campaign, as its realm wears it; null for a home of no campaign. */
export const campaignMarkOf = (home: NativeRows["CampaignHome"] | undefined): CampaignMark | null => {
  if (!home) return null;
  const skin = realmSkinOf(home);
  if (!skin) {
    if (import.meta.env.DEV) throw new Error(`Campaign ${home.campaign_id} has no realm skin`);
    return null;
  }
  return { line: REALM_SKINS[skin].label, golden: isGoldenCampaignHome(home), icon: realmSkinIcon(skin) };
};

export const readCampaignHome = (store: Pick<NativeFactStore, "get">, realm: NativeRows["Structure"]) =>
  store.get("CampaignHome", { game_id: realm.game_id, home: realm.entity_id });

/** The realm's campaign mark, read again as the home's facts change. */
export const useCampaignMark = (realm: NativeRows["Structure"] | null): CampaignMark | null => {
  const { setup } = useGame();
  useNativeRevision(["CampaignHome"]);
  return realm ? campaignMarkOf(readCampaignHome(setup.store, realm)) : null;
};
