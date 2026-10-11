import { useQueries } from "@tanstack/react-query";

import { useGame } from "@/hooks/context/game-context";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutWalletOf } from "@/hooks/context/payout-wallet";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { fetchApi } from "@/runtime/app-api";
import { requireActiveGame } from "@/runtime/world/store";
import { configManager, type ExpeditionRules, getCanonicalRealmMetadata } from "@bibliothecadao/eternum";
import { feltEquals, type NativeRows, safeInteger } from "@bibliothecadao/eternum/game-client";
import type { PayoutWallet } from "@realms-world/identity";

import { useRealmStores } from "../realm-stores";
import { planRealmLabor, type RealmLaborPlan } from "./realm-labor";

/** A Realm gives its labor once a UTC day, shard-wide, whatever the game's own day schedule (entry.cairo, labor_day). */
const DAY_SECONDS = 86_400;

/** The player's Realm labor today: their wallet, each known Realm's state, and what a claim gives the realm's store. */
interface RealmLabor {
  wallet: PayoutWallet;
  plan: RealmLaborPlan;
  perRealm: number;
  cap: number;
  /** The realm's labor now. */
  held: number | undefined;
  /** Until the UTC day ends, when every Realm is ready again. */
  secondsLeft: number;
}

/**
 * Realm labor over the game's facts alone: the Realms this account has claimed labor with are the ones its labor
 * grants name (the shard keeps a grant per Realm and UTC day, and serves the account its own), today's grants say which
 * gave already, and the shard's labor rules and the realm's labor store say what a claim gives. Nothing enumerates a
 * wallet's Realms: a new one is added by its number. Undefined until the session, the rules and the realm are known.
 */
export const useRealmLabor = (
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
): RealmLabor | undefined => {
  const { setup } = useGame();
  const { session } = useIdentitySession();
  const now = useNowSeconds();
  useNativeRevision(LABOR_MODELS);
  const store = useRealmStores(realm, rules)?.labor;
  const today = BigInt(Math.floor(now / DAY_SECONDS));
  const grants = realm
    ? [...setup.store.rows("LaborGrant")].filter((grant) => feltEquals(grant.account, realm.owner))
    : [];
  const known = useKnownRealms([...new Set(grants.map((grant) => grant.realm_id))].toSorted((a, b) => a - b));
  const wallet = session ? payoutWalletOf(session.user) : null;
  const laborRules = setup.store.get("LaborRules", { game_id: configManager.getActiveGameId() });
  if (!wallet || !laborRules || !realm) return undefined;
  const perRealm = Number(laborRules.amount);
  const cap = laborRules.account_daily_limit;
  return {
    wallet,
    plan: planRealmLabor({
      realms: known.map((held) => ({
        ...held,
        claimedToday: grants.some((grant) => grant.realm_id === held.realmId && grant.day === today),
      })),
      perRealm,
      cap,
      labor: { held: store?.amount ?? 0, limit: store?.limit },
    }),
    perRealm,
    cap,
    held: store?.amount,
    secondsLeft: DAY_SECONDS - (now % DAY_SECONDS),
  };
};

const LABOR_MODELS = ["LaborRules", "LaborGrant"] as const;

/** Each known Realm with its canonical name and Order, in the order given; one still being read is left out. */
const useKnownRealms = (realmIds: readonly number[]) =>
  useQueries({
    queries: realmIds.map((realmId) => ({
      queryKey: ["canonical-realm-metadata", realmId],
      queryFn: () => getCanonicalRealmMetadata(realmId),
      staleTime: Infinity,
    })),
  }).flatMap(({ data }, index) => (data ? [{ realmId: realmIds[index], name: data.name, order: data.order }] : []));

/**
 * POST /api/value/labor for one Realm: the relay checks the Realm sits in the account's wallet and has the shard grant
 * its labor to this realm, which then shows through the game's own facts.
 */
export const claimRealmLabor = async (realmId: number, home: NativeRows["Structure"]): Promise<void> => {
  const game = requireActiveGame();
  const response = await fetchApi(`/api/value/labor?chainId=${game.chainId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ realm: { gameId: game.gameId, realmId, home: String(safeInteger(home.entity_id)) } }),
  });
  if (!response.ok) throw new Error(`Labor answered ${response.status}`);
};
