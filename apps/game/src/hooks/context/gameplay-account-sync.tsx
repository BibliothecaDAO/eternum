import { useAccountStore } from "@/hooks/store/use-account-store";
import { configureGameplayAccountSubmits } from "@/account/gameplay-account-submit";
import { IDENTITY_SESSION_CHANGED_EVENT } from "@/hooks/context/identity-session";
import { useActiveWorldProfile } from "@/runtime/world/use-active-world";
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
import { resolveEndpoint, type GameChain } from "@realms-world/chain";
import { createIdentityClient } from "@realms-world/identity";
import { useAccount } from "@starknet-react/core";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { addAddressPadding, num } from "starknet";
import { env } from "../../../env";

const identityOrigin = resolveEndpoint(env.VITE_PUBLIC_IDENTITY_ORIGIN, {
  name: "VITE_PUBLIC_IDENTITY_ORIGIN",
  browserFacing: true,
});
const identityClient = createIdentityClient({ baseUrl: `${identityOrigin}/api/auth` });
const gameplayAccountApi = createGameplayAccountApi({ baseUrl: identityOrigin });

export function GameplayAccountSync({ children }: { children: ReactNode }) {
  const activeWorld = useActiveWorldProfile();
  const { address: connectedIdentityAddress } = useAccount();
  const setGameplayAccount = useAccountStore((state) => state.setGameplayAccount);
  const [identitySessionRevision, setIdentitySessionRevision] = useState(0);

  useEffect(() => {
    const refreshSession = () => setIdentitySessionRevision((revision) => revision + 1);
    window.addEventListener(IDENTITY_SESSION_CHANGED_EVENT, refreshSession);
    return () => window.removeEventListener(IDENTITY_SESSION_CHANGED_EVENT, refreshSession);
  }, []);

  useEffect(() => {
    let active = true;
    setGameplayAccount(null, null);

    const sync = async () => {
      if (!activeWorld?.rpcUrl) return;

      try {
        const chain = activeWorld.chain as GameChain;
        const session = await identityClient.getSession();
        const owner = resolveGameplayOwner(session?.user.id ?? null, connectedIdentityAddress);
        if (owner === null) return;

        const accountConfig = resolveGameplayAccountConfig(activeWorld);
        const provider = getCachedRpcProvider(activeWorld.rpcUrl);
        await assertGameplayAccountClassDeclared(provider, accountConfig.classHash);
        const chainId = await provider.getChainId();
        const storedKey = getStoredGameplayKey({ storage: localStorage, chainId, owner });
        const key = storedKey ?? getOrCreateGameplayKey({ storage: localStorage, chain, chainId, owner });
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
          setGameplayAccount(configureGameplayAccountSubmits(account, chain), addAddressPadding(owner));
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
  }, [activeWorld, connectedIdentityAddress, identitySessionRevision, setGameplayAccount]);

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
