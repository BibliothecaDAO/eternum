import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { fetchApi } from "@/runtime/app-api";
import { requireActiveGame } from "@/runtime/world/store";
import { dayOf, type ExpeditionRules } from "@bibliothecadao/eternum";
import { type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useRealmStores } from "../realm-stores";
import { campaignMarkOf, isGoldenHome, readCampaignHome } from "./campaign-home";
import { planRealmLabor } from "./realm-labor";

const LABOR_MODELS = ["LaborRules", "LaborGrant", "SettledRealm", "CampaignHome"] as const;

/**
 * Eligibility, today's claim and the available space all come from the native facts. A home claims when it was founded
 * with a held Realm or with a campaign's ticket; each source uses its preset's grant amounts.
 */
export const useRealmLabor = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(LABOR_MODELS);
  const labor = useRealmStores(realm, rules)?.labor;
  const day = dayOf(rules, now);
  if (!realm || !day) return undefined;
  const { game_id, entity_id } = realm;
  const laborRules = setup.store.get("LaborRules", { game_id });
  if (!laborRules || labor?.amount === undefined) return undefined;
  const settled = setup.store.get("SettledRealm", { game_id, realm_id: realm.metadata.realm_id });
  const campaign = readCampaignHome(setup.store, realm);
  const golden = isGoldenHome(campaign);
  const amount = Number(golden ? laborRules.golden_amount : laborRules.amount);
  const essence = Number(golden ? laborRules.golden_essence : campaign ? laborRules.campaign_essence : 0);
  const claimed = setup.store.get("LaborGrant", {
    game_id,
    home: entity_id,
    day: BigInt(day.index),
  });
  return {
    plan: planRealmLabor({
      eligible: settled?.home === entity_id || campaign !== undefined,
      claimed: !!claimed,
      amount,
      essence,
      held: labor.amount,
      limit: labor.limit,
    }),
    dailyAmount: amount,
    dailyEssence: essence,
    mark: campaignMarkOf(campaign),
    secondsLeft: day.end - now,
    claim: () => claimRealmLabor(realm),
  };
};

export const claimRealmLabor = async (home: NativeRows["Structure"]): Promise<void> => {
  const game = requireActiveGame();
  const response = await fetchApi(`/api/value/labor?chainId=${game.chainId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId: home.game_id, home: String(home.entity_id) }),
  });
  if (!response.ok) throw new Error("The labor could not be claimed.");
};
