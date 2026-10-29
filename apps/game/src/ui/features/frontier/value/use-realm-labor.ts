import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { recordClientActionSendStage } from "@/observability/client-action-latency";
import { fetchApi } from "@/runtime/app-api";
import { requireActiveGame } from "@/runtime/world/store";
import { dayOf, homeDailyClaim, type ExpeditionRules } from "@bibliothecadao/eternum";
import { type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useRealmStores } from "../realm-stores";
import { campaignMarkOf, readCampaignHome } from "./campaign-home";
import { planRealmLabor } from "./realm-labor";

const LABOR_MODELS = ["LaborRules", "LaborGrant", "SettledRealm", "CampaignHome", "GameRegistry"] as const;

/**
 * Eligibility, today's claim and the available space all come from the native facts; what the home claims each day is
 * homeDailyClaim's, the reader the Day open push uses too.
 */
export const useRealmLabor = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(LABOR_MODELS);
  const labor = useRealmStores(realm, rules)?.labor;
  const day = dayOf(rules, now);
  if (!realm || !day) return undefined;
  const { game_id, entity_id } = realm;
  if (!setup.store.get("LaborRules", { game_id }) || labor?.amount === undefined) return undefined;
  const daily = homeDailyClaim(setup.store, { gameId: game_id, entityId: entity_id, realmId: realm.metadata.realm_id });
  const claimed = setup.store.get("LaborGrant", {
    game_id,
    home: entity_id,
    day: BigInt(day.index),
  });
  return {
    plan: planRealmLabor({
      eligible: daily !== null,
      claimed: !!claimed,
      amount: daily?.labor ?? 0,
      essence: daily?.essence ?? 0,
      held: labor.amount,
      limit: labor.limit,
    }),
    dailyAmount: daily?.labor ?? 0,
    dailyEssence: daily?.essence ?? 0,
    mark: campaignMarkOf(readCampaignHome(setup.store, realm)),
    secondsLeft: day.end - now,
    nextDay: day.end < Number(setup.store.get("GameRegistry", { game_id })?.end_at ?? 0) ? day.index + 2 : null,
    claim: () => claimRealmLabor(realm),
  };
};

export const claimRealmLabor = async (home: NativeRows["Structure"]): Promise<void> => {
  const game = requireActiveGame();
  const send = `labor:${(laborClaims += 1)}`;
  recordClientActionSendStage(send, "command");
  const response = await fetchApi(`/api/value/labor?chainId=${game.chainId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId: home.game_id, home: String(home.entity_id) }),
  });
  if (!response.ok) throw new Error("The labor could not be claimed.");
  const reply = (await response.json()) as { grant: { transactionHash: string | null } };
  recordClientActionSendStage(send, "included", "relay", reply.grant.transactionHash ?? undefined);
};

let laborClaims = 0;
