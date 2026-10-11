import { useQueries } from "@tanstack/react-query";
import { useState } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { fetchApi } from "@/runtime/app-api";
import { requireActiveGame } from "@/runtime/world/store";
import { configManager, type ExpeditionRules, getCanonicalRealmMetadata } from "@bibliothecadao/eternum";
import { feltEquals, type NativeRows, safeInteger } from "@bibliothecadao/eternum/game-client";

import { useRealmStores } from "../realm-stores";
import { planRealmLabor, type RealmLaborPlan } from "./realm-labor";

/** A Realm gives its labor once a UTC day, shard-wide, whatever the game's own day schedule (entry.cairo, labor_day). */
const DAY_SECONDS = 86_400;

/** The player's Realm labor today: their wallet, each known Realm's state, and what a claim gives the realm's store. */
interface RealmLabor {
  /** The linked wallet's address; null when the account has none. */
  wallet: string | null;
  plan: RealmLaborPlan;
  perRealm: number;
  cap: number;
  /** The realm's labor now. */
  held: number | undefined;
  /** Until the UTC day ends, when every Realm is ready again. */
  secondsLeft: number;
  /**
   * Claims the labor of the Realms named, in one request, and answers the ones the relay refused as no longer in the
   * linked wallet. Those are marked on the list and left out of later claims.
   */
  claim(realmIds: readonly number[]): Promise<readonly number[]>;
}

/**
 * Realm labor over the game's facts alone: the Realms this account has claimed labor with are the ones its labor
 * grants name (the shard keeps a grant per Realm and UTC day, and serves the account its own), today's grants say which
 * gave already, and the shard's labor rules and the realm's labor store say what a claim gives. Nothing enumerates a
 * wallet's Realms: a new one is added by its number, and one the wallet has since let go is known only when a claim is
 * refused for it, which is remembered for that wallet while the game is open. Undefined until the session, the rules
 * and the realm are known.
 */
export const useRealmLabor = (
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
): RealmLabor | undefined => {
  const { setup } = useGame();
  const { session } = useIdentitySession();
  const [refusals, setRefusals] = useState<{ wallet: string | null; realmIds: readonly number[] }>(NO_REFUSALS);
  const now = useNowSeconds();
  useNativeRevision(LABOR_MODELS);
  const store = useRealmStores(realm, rules)?.labor;
  const today = BigInt(Math.floor(now / DAY_SECONDS));
  const grants = realm
    ? [...setup.store.rows("LaborGrant")].filter((grant) => feltEquals(grant.account, realm.owner))
    : [];
  const known = useKnownRealms([...new Set(grants.map((grant) => grant.realm_id))].toSorted((a, b) => a - b));
  const laborRules = setup.store.get("LaborRules", { game_id: configManager.getActiveGameId() });
  if (!session || !laborRules || !realm) return undefined;
  const perRealm = Number(laborRules.amount);
  const cap = laborRules.account_daily_limit;
  const wallet = payoutAddressOf(session.user);
  // A refusal is the linked wallet's: another wallet linked since starts with none.
  const notInWallet = refusals.wallet === wallet ? refusals.realmIds : [];
  const claim = async (realmIds: readonly number[]) => {
    const { granted, refused } = await claimRealmLabor(realmIds, realm);
    setRefusals({ wallet, realmIds: [...notInWallet.filter((realmId) => !granted.includes(realmId)), ...refused] });
    return refused;
  };
  return {
    wallet,
    claim,
    plan: planRealmLabor({
      realms: known.map((held) => ({
        ...held,
        claimedToday: grants.some((grant) => grant.realm_id === held.realmId && grant.day === today),
        inWallet: !notInWallet.includes(held.realmId),
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
const NO_REFUSALS = { wallet: null, realmIds: [] };

/** Each known Realm with its canonical name and Order, in the order given; one still being read is left out. */
const useKnownRealms = (realmIds: readonly number[]) =>
  useQueries({
    queries: realmIds.map((realmId) => ({
      queryKey: ["canonical-realm-metadata", realmId],
      queryFn: () => getCanonicalRealmMetadata(realmId),
      staleTime: Infinity,
    })),
  }).flatMap(({ data }, index) => (data ? [{ realmId: realmIds[index], name: data.name, order: data.order }] : []));

/** What the relay did with a claim: the Realms it had granted, and those it refused as not in the linked wallet. */
interface LaborClaimOutcome {
  granted: number[];
  refused: number[];
}

/**
 * POST /api/value/labor for every Realm named, in one request: the relay has the shard grant, in one call, the labor
 * of those the account's wallet still holds to this realm (which then shows through the game's own facts), and names
 * the others as refused. It answers the same shape when none is held, as a refusal of the whole request; any other
 * failure, where no Realm was judged, throws.
 */
export const claimRealmLabor = async (
  realmIds: readonly number[],
  home: NativeRows["Structure"],
): Promise<LaborClaimOutcome> => {
  const game = requireActiveGame();
  const homeId = String(safeInteger(home.entity_id));
  const response = await fetchApi(`/api/value/labor?chainId=${game.chainId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ realms: realmIds.map((realmId) => ({ gameId: game.gameId, realmId, home: homeId })) }),
  });
  const reply = (await response.json().catch(() => null)) as LaborReply | null;
  if (!Array.isArray(reply?.grants) || !Array.isArray(reply.refused))
    throw new Error(`Labor answered ${response.status}`);
  return {
    granted: reply.grants.map((grant) => Number(grant.realmId)),
    refused: reply.refused.map((refusal) => Number(refusal.realmId)),
  };
};

/** The relay's reply to a labor claim, granted (200) or with no Realm held (409): each Realm by its decimal id. */
interface LaborReply {
  grants: { realmId: string }[];
  refused: { realmId: string }[];
}
