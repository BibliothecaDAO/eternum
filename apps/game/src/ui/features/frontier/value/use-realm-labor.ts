import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { recordClientActionSendStage } from "@/observability/client-action-latency";
import { fetchApi } from "@/runtime/app-api";
import { requireActiveGame } from "@/runtime/world/store";
import { canonicalRealm, dayOf, homeDailyClaim, type ExpeditionRules } from "@bibliothecadao/eternum";
import { type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useRealmStores } from "../realm-stores";
import { campaignMarkOf, readCampaignHome, type CampaignMark } from "./campaign-home";
import { planRealmLabor, seasonStrip, type LaborHome } from "./realm-labor";

const LABOR_MODELS = ["LaborRules", "LaborGrant", "SettledRealm", "CampaignHome", "GameRegistry"] as const;

/**
 * Eligibility, today's claim, the available space and the season's past claims all come from the native facts; what the
 * home claims each day is homeDailyClaim's, the reader the Day open push uses too.
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
  const claimedOn = (index: number) =>
    !!setup.store.get("LaborGrant", { game_id, home: entity_id, day: BigInt(index) });
  const mark = campaignMarkOf(readCampaignHome(setup.store, realm));
  const endAt = Number(setup.store.get("GameRegistry", { game_id })?.end_at ?? 0);
  const claimed = claimedOn(day.index);
  return {
    plan: planRealmLabor({
      eligible: daily !== null,
      claimed,
      amount: daily?.labor ?? 0,
      essence: daily?.essence ?? 0,
      held: labor.amount,
      limit: labor.limit,
    }),
    dailyAmount: daily?.labor ?? 0,
    dailyEssence: daily?.essence ?? 0,
    home: laborHomeOf(daily !== null, mark, realm.metadata.realm_id),
    days: seasonStrip({
      today: day.index,
      last: lastDayOf(rules, day, endAt),
      founded: dayOf(rules, Number(realm.base.created_at))?.index ?? 0,
      claimed: claimedOn,
      claimedToday: claimed,
    }),
    secondsLeft: day.end - now,
    nextDay: day.end < endAt ? day.index + 2 : null,
    claim: () => claimRealmLabor(realm),
  };
};

/** The facts the Realm Labor sheet draws: the hook's reading without its claim. */
export type RealmLaborFacts = Omit<NonNullable<ReturnType<typeof useRealmLabor>>, "claim">;

/** The home a claim comes from, or null for a home that claims nothing. */
const laborHomeOf = (claims: boolean, mark: CampaignMark | null, realmId: number): LaborHome | null => {
  if (!claims) return null;
  if (mark) return { kind: "campaign", mark };
  return { kind: "realm", realmId, name: canonicalRealm(realmId).name };
};

/** The season's last day by index: the day its end falls in, or today when it ends with today (or has no end set). */
const lastDayOf = (rules: ExpeditionRules, today: { index: number; end: number }, endAt: number) =>
  endAt > today.end ? (dayOf(rules, endAt - 1)?.index ?? today.index) : today.index;

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
