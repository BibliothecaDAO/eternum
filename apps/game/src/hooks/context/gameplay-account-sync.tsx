import { useAccountStore } from "@/hooks/store/use-account-store";
import { configureGameplayAccountSubmits } from "@bibliothecadao/eternum/game-client";
import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { parseEntryRoute, parsePlayRoute } from "@/play/navigation/play-route";
import { requireOpenShard } from "@/runtime/world/shards";
import { isExplicitSpectateSession } from "@/utils/spectator-session";
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import { DeviceRemovedError, getOrCreateDeviceKey, joinRealmsAccount } from "@bibliothecadao/eternum";
import { IdentityRequestError } from "@realms-world/identity";
import type { Shard } from "@bibliothecadao/eternum/game-client";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

// The account is joined when a player enters a game to play: its deploy happens at game entry, not in the first click,
// and never for a shard the player only opens or spectates.
const usePlayingShardChainId = (): string | null => {
  const location = useLocation();
  const game = parsePlayRoute(location) ?? parseEntryRoute(location);
  return game && !isExplicitSpectateSession() ? game.chainId : null;
};

/** Keyed by chain id, so moving between the scenes of one game keeps the joined account. */
const useGameplayShard = (onError: (message: string) => void): Shard | null => {
  const routeChainId = usePlayingShardChainId();
  const [shard, setShard] = useState<Shard | null>(null);
  useEffect(() => {
    if (!routeChainId) return;
    let active = true;
    requireOpenShard(routeChainId).then(
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
    (message: string) => {
      console.error("gameplay_shard_open_failed", { error: message });
      setGameplayAccount(null, null, ACCOUNT_SETUP_FAILED);
    },
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
        const state = accountStateOf(error);
        if (!state) {
          const message = error instanceof Error ? error.message : "Gameplay account provisioning failed";
          console.error("gameplay_account_sync_failed", { error: message });
        }
        if (active) setGameplayAccount(null, null, state ?? ACCOUNT_SETUP_FAILED);
      },
    );
    return () => {
      active = false;
    };
  }, [session, setGameplayAccount, shard]);

  return <>{children}</>;
}

/** The account states a player resolves themselves; they are not failures and are not logged as errors. */
export const ACCOUNT_NOT_SECURED = "account_not_secured";
const DEVICE_REMOVED = "device_removed";

export const isAccountStatePrompt = (provisioningError: string | null): boolean =>
  provisioningError === ACCOUNT_NOT_SECURED || provisioningError === DEVICE_REMOVED;

// Every surface shows the provisioning error to the player as is, so a failure is stored as one sentence and its
// detail (an RPC dump, a transaction's params) goes to the console only.
const ACCOUNT_SETUP_FAILED = "Your account could not be set up for this game. Try again in a moment.";

const accountStateOf = (error: unknown): string | null => {
  if (error instanceof IdentityRequestError && error.code === ACCOUNT_NOT_SECURED) return ACCOUNT_NOT_SECURED;
  if (error instanceof DeviceRemovedError) return DEVICE_REMOVED;
  return null;
};
