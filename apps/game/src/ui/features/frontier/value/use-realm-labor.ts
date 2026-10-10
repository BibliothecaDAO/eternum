import { useQuery } from "@tanstack/react-query";

import { useGame } from "@/hooks/context/game-context";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutWalletOf } from "@/hooks/context/payout-wallet";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { fetchApi } from "@/runtime/app-api";
import { requireActiveGame } from "@/runtime/world/store";
import { configManager, type ExpeditionRules, getCanonicalRealmMetadata } from "@bibliothecadao/eternum";
import { type NativeRows, safeInteger } from "@bibliothecadao/eternum/game-client";
import type { PayoutWallet } from "@realms-world/identity";

import { useRealmStores } from "../realm-stores";
import { type HeldRealm, planRealmLabor, type RealmLaborPlan } from "./realm-labor";

/** A Realm gives its labor once a UTC day, shard-wide, whatever the game's own day schedule (entry.cairo, labor_day). */
const DAY_SECONDS = 86_400;

/** The player's Realm labor today: their wallet, each held Realm's state, and what a claim gives the realm's store. */
export interface RealmLabor {
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
 * Realm labor over the game's facts: the Realms the payout wallet holds (the relay reads them on Starknet), the
 * grants the shard recorded today, its labor rules and the realm's labor store. Undefined until all are known; the
 * held Realms' read is returned beside it so its failure can be said.
 */
export const useRealmLabor = (rules: ExpeditionRules, realm: NativeRows["Structure"] | null) => {
  const { setup } = useGame();
  const { session } = useIdentitySession();
  const now = useNowSeconds();
  useNativeRevision(LABOR_MODELS);
  const wallet = session ? payoutWalletOf(session.user) : null;
  // A watcher with no realm of their own has nowhere to store labor: their wallet's Realms are not asked for.
  const realms = useHeldRealms(realm ? wallet : null);
  const store = useRealmStores(realm, rules)?.labor;
  const laborRules = setup.store.get("LaborRules", { game_id: configManager.getActiveGameId() });
  const day = Math.floor(now / DAY_SECONDS);
  const labor: RealmLabor | undefined =
    wallet && laborRules && (wallet.status === "no_wallet" || realms.data)
      ? {
          wallet,
          plan: planRealmLabor({
            realms: (realms.data ?? []).map((held) => ({
              ...held,
              claimedToday: setup.store.get("LaborGrant", { realm_id: held.realmId, day: BigInt(day) }) !== undefined,
            })),
            perRealm: Number(laborRules.amount),
            cap: laborRules.account_daily_limit,
            labor: { held: store?.amount ?? 0, limit: store?.limit },
          }),
          perRealm: Number(laborRules.amount),
          cap: laborRules.account_daily_limit,
          held: store?.amount,
          secondsLeft: DAY_SECONDS - (now % DAY_SECONDS),
        }
      : undefined;
  return { labor, realms };
};

const LABOR_MODELS = ["LaborRules", "LaborGrant"] as const;

/** The Realms a linked payout wallet holds on Starknet, each with its name and Order; none asked without a wallet. */
const useHeldRealms = (wallet: PayoutWallet | null) => {
  const address = wallet && wallet.status !== "no_wallet" ? wallet.address : null;
  return useQuery({
    queryKey: ["value", "realms", address],
    queryFn: readHeldRealms,
    enabled: address !== null,
    staleTime: 60_000,
    retry: 1,
  });
};

/** GET /api/value/realms: the Realm ids in the signed-in account's payout wallet, as the relay reads them. */
const readHeldRealms = async (): Promise<Omit<HeldRealm, "claimedToday">[]> => {
  const response = await fetchApi("/api/value/realms", { credentials: "include" });
  if (!response.ok) throw new Error(`Realms answered ${response.status}`);
  const { realms } = (await response.json()) as { realms: number[] };
  return Promise.all(
    realms.map(async (realmId) => {
      const { name, order } = await getCanonicalRealmMetadata(realmId);
      return { realmId, name, order };
    }),
  );
};

/**
 * POST /api/value/labor for one held Realm: the relay checks the Realm sits in the account's wallet and has the shard
 * grant its labor to this realm, which then shows through the game's own facts.
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
