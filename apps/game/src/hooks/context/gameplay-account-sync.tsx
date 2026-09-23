import { useAccountStore } from "@/hooks/store/use-account-store";
import { configureGameplayAccountSubmits } from "@bibliothecadao/eternum/game-client";
import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { parseEntryRoute, parsePlayRoute } from "@/play/navigation/play-route";
import { openDefaultShard, requireOpenShard } from "@/runtime/world/shards";
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import { getOrCreateDeviceKey, joinRealmsAccount } from "@bibliothecadao/eternum";
import type { Shard } from "@bibliothecadao/eternum/game-client";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

// The gameplay account is an identity-level fact of a shard, not per-game state. On the landing it targets the
// default shard, so a signed-in player's account exists before any game is entered; a route naming a game targets
// that game's shard.
const useGameplayShardChainId = (): string | null => {
  const location = useLocation();
  return (parsePlayRoute(location) ?? parseEntryRoute(location))?.chainId ?? null;
};

const resolveGameplayShard = (chainId: string | null): Promise<Shard> =>
  chainId ? requireOpenShard(chainId) : openDefaultShard();

/** Keyed by chain id, so moving from the landing into a game on the default shard keeps the joined account. */
const useGameplayShard = (onError: (message: string) => void): Shard | null => {
  const routeChainId = useGameplayShardChainId();
  const [shard, setShard] = useState<Shard | null>(null);
  useEffect(() => {
    let active = true;
    resolveGameplayShard(routeChainId).then(
      (resolved) => active && setShard((current) => (current?.chainId === resolved.chainId ? current : resolved)),
      (error: unknown) => active && onError(error instanceof Error ? error.message : "Shard could not be opened"),
    );
    return () => {
      active = false;
    };
  }, [routeChainId, onError]);
  return shard;
};

/**
 * Makes this browser's device key a signer of the signed-in player's Realms account on the current shard: the
 * account is deployed on first play, or this device is added to it, each with the guardian's approval.
 */
export function GameplayAccountSync({ children }: { children: ReactNode }) {
  // Keyed by the session object, not only the Realms id: a refreshed session (a passkey just added) retries the join.
  const { session } = useIdentitySession();
  const setGameplayAccount = useAccountStore((state) => state.setGameplayAccount);
  const reportShardFailure = useCallback(
    (message: string) => setGameplayAccount(null, null, message),
    [setGameplayAccount],
  );
  const shard = useGameplayShard(reportShardFailure);

  useEffect(() => {
    const realmsId = session?.user.realmsId;
    if (!realmsId || !shard) return;
    let active = true;
    setGameplayAccount(null, null);
    joinRealmsAccount({
      provider: getCachedRpcProvider(shard.rpcUrl),
      shard,
      realmsId,
      device: getOrCreateDeviceKey(localStorage),
      approve: identityClient.approveDeviceChange,
    }).then(
      (account) => active && setGameplayAccount(configureGameplayAccountSubmits(account, shard.chainId), realmsId),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : "Gameplay account provisioning failed";
        console.error("gameplay_account_sync_failed", { error: message });
        if (active) setGameplayAccount(null, null, message);
      },
    );
    return () => {
      active = false;
    };
  }, [session, setGameplayAccount, shard]);

  return <>{children}</>;
}
