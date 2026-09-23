import { recoverGameplaySigner, rotateBoundGameplaySigner } from "@/account/gameplay-signer-recovery";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { configureGameplayAccountSubmits } from "@bibliothecadao/eternum/game-client";
import { identityOrigin, useIdentitySession } from "@/hooks/context/identity-session";
import { parseEntryRoute, parsePlayRoute } from "@/play/navigation/play-route";
import { openDefaultShard, requireOpenShard } from "@/runtime/world/shards";
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import {
  assertGameplayAccountClassDeclared,
  connectGameplayAccount,
  createGameplayAccountApi,
  type GameplayAccountApi,
  ensureGameplayAccount,
  getOrCreateGameplayKey,
  getStoredGameplayKey,
  readBoundGameplayAccount,
  readGameplayAccountPublicKey,
} from "@bibliothecadao/eternum";
import type { Shard } from "@bibliothecadao/eternum/game-client";
import { useAccount } from "@starknet-react/core";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { addAddressPadding, num } from "starknet";

let gameplayAccountApi: GameplayAccountApi | null = null;
/** Built on first use: the API lives on the page's own origin, which exists only once a document does. */
const gameplayAccountApiOf = (): GameplayAccountApi =>
  (gameplayAccountApi ??= createGameplayAccountApi({ baseUrl: identityOrigin() }));

// The gameplay account is an identity-level fact of a shard, not per-game state. On the landing it targets the
// default shard, so a signed-in user provisions and binds before any game is entered; a route naming a game
// targets that game's shard. Gating this on an entered game was the dead end that stranded fresh players at
// "Connect wallet": registration needed the account, the account needed an entered game.
const useGameplayShardChainId = (): string | null => {
  const location = useLocation();
  return (parsePlayRoute(location) ?? parseEntryRoute(location))?.chainId ?? null;
};

const resolveGameplayShard = (chainId: string | null): Promise<Shard> =>
  chainId ? requireOpenShard(chainId) : openDefaultShard();

/** Keyed by chain id, so moving from the landing into a game on the default shard keeps the provisioned account. */
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

export function GameplayAccountSync({ children }: { children: ReactNode }) {
  const { address: connectedIdentityAddress } = useAccount();
  const { status: identityStatus, session } = useIdentitySession();
  const sessionOwner = session?.user.id ?? null;
  const setGameplayAccount = useAccountStore((state) => state.setGameplayAccount);
  const reportShardFailure = useCallback(
    (message: string) => setGameplayAccount(null, null, message),
    [setGameplayAccount],
  );
  const shard = useGameplayShard(reportShardFailure);

  useEffect(() => {
    if (identityStatus === "loading" || !shard) return;

    let active = true;
    setGameplayAccount(null, null);

    const sync = async () => {
      try {
        const owner = resolveGameplayOwner(sessionOwner, connectedIdentityAddress);
        if (owner === null) return;

        const accountConfig = resolveGameplayAccountConfig(shard);
        const provider = getCachedRpcProvider(shard.rpcUrl);
        await assertGameplayAccountClassDeclared(provider, accountConfig.classHash);
        const chainId = shard.chainId;
        const storedKey = getStoredGameplayKey({ storage: localStorage, chainId, owner });
        const key = storedKey ?? getOrCreateGameplayKey({ storage: localStorage, chainId, owner });
        const boundAccount = await readBoundGameplayAccount(provider, accountConfig.registryAddress, owner);

        const account = boundAccount
          ? await recoverBoundGameplayAccount({
              provider,
              boundAccount,
              classHash: accountConfig.classHash,
              key,
              needsRotation: storedKey === null,
            })
          : await deployAndBindGameplayAccount({
              provider,
              authority: accountConfig.authority,
              classHash: accountConfig.classHash,
              key,
              owner,
            });

        if (active) {
          setGameplayAccount(
            configureGameplayAccountSubmits(account, chainId, () =>
              recoverGameplaySigner({
                provider,
                address: account.address,
                publicKey: key.publicKey,
                api: gameplayAccountApiOf(),
                isCurrent: () => active && canIssueOrders(),
              }),
            ),
            addAddressPadding(owner),
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Gameplay account provisioning failed";
        console.error("gameplay_account_sync_failed", { error: message });
        if (active) {
          setGameplayAccount(null, null, message);
        }
      }
    };

    void sync();
    return () => {
      active = false;
    };
  }, [connectedIdentityAddress, identityStatus, sessionOwner, setGameplayAccount, shard]);

  return <>{children}</>;
}

function resolveGameplayOwner(
  sessionOwner: string | null,
  connectedIdentityAddress: string | undefined,
): string | null {
  if (!sessionOwner) return null;
  if (connectedIdentityAddress && BigInt(sessionOwner) !== BigInt(connectedIdentityAddress)) {
    throw new Error("Connected wallet does not match the Realms identity session");
  }
  return num.toHex(sessionOwner);
}

function resolveGameplayAccountConfig(shard: Shard) {
  const { playerRegistry, bindingAuthority } = shard.contracts;
  if (!playerRegistry) throw new Error(`Shard ${shard.url} names no player registry`);
  if (!bindingAuthority) throw new Error(`Shard ${shard.url} names no binding authority`);
  return { authority: bindingAuthority, classHash: shard.accountClassHash, registryAddress: playerRegistry };
}

async function recoverBoundGameplayAccount({
  provider,
  boundAccount,
  classHash,
  key,
  needsRotation,
}: {
  provider: ReturnType<typeof getCachedRpcProvider>;
  boundAccount: string;
  classHash: string;
  key: { privateKey: string; publicKey: string };
  needsRotation: boolean;
}) {
  const currentPublicKey = await readGameplayAccountPublicKey(provider, boundAccount);
  if (needsRotation || BigInt(currentPublicKey) !== BigInt(key.publicKey)) {
    await rotateBoundGameplaySigner(gameplayAccountApiOf(), boundAccount, key.publicKey);
  }
  return connectGameplayAccount({ address: boundAccount, classHash, privateKey: key.privateKey, provider });
}

async function deployAndBindGameplayAccount({
  provider,
  authority,
  classHash,
  key,
  owner,
}: {
  provider: ReturnType<typeof getCachedRpcProvider>;
  authority: string;
  classHash: string;
  key: { privateKey: string; publicKey: string };
  owner: string;
}) {
  const account = await ensureGameplayAccount({
    authority,
    classHash,
    owner,
    privateKey: key.privateKey,
    provider,
    publicKey: key.publicKey,
  });
  await gameplayAccountApiOf().bind(account.address, key.publicKey);
  return account;
}
