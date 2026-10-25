import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { fetchApi } from "@/runtime/app-api";
import { requireActiveGame } from "@/runtime/world/store";
import { type ExpeditionRules } from "@bibliothecadao/eternum";
import { type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useRealmStores } from "../realm-stores";
import { planRealmLabor } from "./realm-labor";

const DAY_SECONDS = 86_400;
const LABOR_MODELS = ["LaborRules", "LaborGrant", "SettledRealm"] as const;

/** Eligibility, today's claim and the available space all come from the native facts. */
export const useRealmLabor = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(LABOR_MODELS);
  const labor = useRealmStores(realm, rules)?.labor;
  if (!realm) return undefined;
  const { game_id, entity_id } = realm;
  const laborRules = setup.store.get("LaborRules", { game_id });
  if (!laborRules || !labor) return undefined;
  const settled = setup.store.get("SettledRealm", { game_id, realm_id: realm.metadata.realm_id });
  const claimed = setup.store.get("LaborGrant", {
    game_id,
    home: entity_id,
    day: BigInt(Math.floor(now / DAY_SECONDS)),
  });
  return {
    plan: planRealmLabor({
      eligible: settled?.home === entity_id,
      claimed: !!claimed,
      amount: Number(laborRules.amount),
      held: labor.amount,
      limit: labor.limit,
    }),
    dailyAmount: Number(laborRules.amount),
    secondsLeft: DAY_SECONDS - (now % DAY_SECONDS),
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
