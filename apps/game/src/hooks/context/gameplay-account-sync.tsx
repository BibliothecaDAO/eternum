import { useAccountStore } from "@/hooks/store/use-account-store";
import { configureGameplayAccountSubmits } from "@/account/gameplay-account-submit";
import { identityOrigin, useIdentitySession } from "@/hooks/context/identity-session";
import { getDefaultWorld } from "@/runtime/world/world-directory";
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import {
  assertGameplayAccountClassDeclared,
  connectGameplayAccount,
  createGameplayAccountApi,
  ensureGameplayAccount,
  getOrCreateGameplayKey,
  getStoredGameplayKey,
  readBoundGameplayAccount,
  readGameplayAccountPublicKey,
} from "@bibliothecadao/eternum";
import type { GameChain } from "@realms-world/chain";
import { useAccount } from "@starknet-react/core";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { addAddressPadding, num } from "starknet";

const gameplayAccountApi = createGameplayAccountApi({ baseUrl: identityOrigin });

interface GameplayWorldTarget {
  chain: GameChain;
  rpcUrl: string;
  bindingAuthorityAddress: string;
  playerAccountClassHash: string;
  playerRegistryAddress: string;
}

// The gameplay account is an identity-level fact of the chain, not per-game state. Its target comes from
// the world directory (committed env), so a signed-in user provisions and binds from the landing — before
// any world is entered. Gating this on the active world profile was the dead end that stranded fresh
// players at "Connect wallet": registration needed the account, the account needed an entered world.
const useGameplayWorldTarget = (): GameplayWorldTarget =>
  useMemo(() => {
    const world = getDefaultWorld();
    return {
      chain: world.chain,
      rpcUrl: world.rpcUrl,
      bindingAuthorityAddress: world.bindingAuthorityAddress,
      playerAccountClassHash: world.playerAccountClassHash,
      playerRegistryAddress: world.playerRegistryAddress,
    };
  }, []);

export function GameplayAccountSync({ children }: { children: ReactNode }) {
  const worldTarget = useGameplayWorldTarget();
  const { address: connectedIdentityAddress } = useAccount();
  const { status: identityStatus, session } = useIdentitySession();
  const sessionOwner = session?.user.id ?? null;
  const setGameplayAccount = useAccountStore((state) => state.setGameplayAccount);

  useEffect(() => {
    if (identityStatus === "loading") return;

    let active = true;
    setGameplayAccount(null, null);

    const sync = async () => {
      try {
        const owner = resolveGameplayOwner(sessionOwner, connectedIdentityAddress);
        if (owner === null) return;

        const accountConfig = resolveGameplayAccountConfig(worldTarget);
        const provider = getCachedRpcProvider(worldTarget.rpcUrl);
        await assertGameplayAccountClassDeclared(provider, accountConfig.classHash);
        const chainId = await provider.getChainId();
        const storedKey = getStoredGameplayKey({ storage: localStorage, chainId, owner });
        const key =
          storedKey ?? getOrCreateGameplayKey({ storage: localStorage, chain: worldTarget.chain, chainId, owner });
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
          setGameplayAccount(configureGameplayAccountSubmits(account, worldTarget.chain), addAddressPadding(owner));
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
  }, [connectedIdentityAddress, identityStatus, sessionOwner, setGameplayAccount, worldTarget]);

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

function resolveGameplayAccountConfig(profile: {
  bindingAuthorityAddress?: string;
  playerAccountClassHash?: string;
  playerRegistryAddress?: string;
}) {
  if (!profile.playerAccountClassHash) throw new Error("World profile has no player account class hash");
  if (!profile.playerRegistryAddress) throw new Error("World profile has no player registry address");
  if (!profile.bindingAuthorityAddress) throw new Error("World profile has no binding authority address");
  return {
    authority: profile.bindingAuthorityAddress,
    classHash: profile.playerAccountClassHash,
    registryAddress: profile.playerRegistryAddress,
  };
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
    const rotatedAccount = await gameplayAccountApi.rotate(key.publicKey);
    if (BigInt(rotatedAccount) !== BigInt(boundAccount)) {
      throw new Error("Binding authority rotated an unexpected gameplay account");
    }
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
  await gameplayAccountApi.bind(account.address, key.publicKey);
  return account;
}
