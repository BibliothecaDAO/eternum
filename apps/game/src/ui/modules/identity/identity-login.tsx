import {
  identityClient,
  identityOrigin,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import Button from "@/ui/design-system/atoms/button";
import { useConnect, useDisconnect, useProvider } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCallback, useRef, useState } from "react";
import { addAddressPadding, constants, stark } from "starknet";

interface IdentityLoginProps {
  className?: string;
  /** "link" attaches a wallet to the signed-in Realms account instead of signing in with it. */
  mode?: "sign-in" | "link";
}

export const IdentityLogin = ({ className = "", mode = "sign-in" }: IdentityLoginProps) => {
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const { connectAsync, connectors, connector: connectedConnector } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { provider } = useProvider();
  const { status, session } = useIdentitySession();
  const applySession = useIdentitySessionStore((state) => state.applySession);
  const [error, setError] = useState<string | null>(null);
  const [pendingWallet, setPendingWallet] = useState<string | null>(null);
  const signingIn = useRef(false);

  /** A Realms account needs no wallet: an anonymous session secured by a passkey on this device. */
  const runPasskey = useCallback(
    async (action: "create" | "sign-in") => {
      if (signingIn.current) return;
      signingIn.current = true;
      setPendingWallet(action);
      setError(null);
      try {
        if (action === "create") {
          await identityClient.signInAnonymously();
          await identityClient.registerPasskey();
          applySession(await identityClient.getSession());
        } else {
          applySession(await identityClient.signInWithPasskey());
        }
      } catch (passkeyError) {
        const message = passkeyError instanceof Error ? passkeyError.message : "Passkey sign-in failed";
        console.error("identity_passkey_failed", { error: message });
        setError(message);
        // An account created before its passkey was cancelled still signs in; it is secured later.
        applySession(await identityClient.getSession().catch(() => null));
      } finally {
        signingIn.current = false;
        setPendingWallet(null);
      }
    },
    [applySession],
  );

  const handleLogin = useCallback(
    async (connector: Connector) => {
      if (signingIn.current) return;
      signingIn.current = true;
      setPendingWallet(connector.id);
      setError(null);
      try {
        if (connectedConnector) await disconnectAsync();
        await connectAsync({ connector });
        if ((await connector.chainId()) !== BigInt(constants.StarknetChainId.SN_MAIN))
          throw new Error("Switch this wallet to Starknet mainnet to sign in.");
        // Use the selected connector immediately; React's account state may still describe the previous wallet.
        const account = await connector.account(provider);
        const proof = {
          address: addAddressPadding(account.address),
          chainId: "SN_MAIN" as const,
          domain: window.location.host,
          uri: identityOrigin(),
          signTypedData: async (message: Parameters<typeof account.signMessage>[0]) =>
            stark.formatSignature(await account.signMessage(message)),
        };
        if (mode === "link") {
          await identityClient.linkWallet(proof);
          await refresh();
        } else {
          applySession(await identityClient.signIn(proof));
        }
      } catch (loginError) {
        const message = loginError instanceof Error ? loginError.message : "Identity login failed";
        console.error("identity_login_failed", { error: message });
        setError(message);
      } finally {
        signingIn.current = false;
        setPendingWallet(null);
      }
    },
    [applySession, connectAsync, connectedConnector, disconnectAsync, mode, provider, refresh],
  );

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {mode === "sign-in" && status === "signed-in" && session ? null : (
        <div className="flex w-full flex-col gap-1">
          {mode === "link" ? null : (
            <>
              <Button
                className="w-full px-4 py-2"
                disabled={pendingWallet !== null || status === "loading"}
                isLoading={pendingWallet === "create"}
                onClick={() => void runPasskey("create")}
              >
                Create a Realms account
              </Button>
              <Button
                className="w-full px-4 py-2"
                disabled={pendingWallet !== null || status === "loading"}
                isLoading={pendingWallet === "sign-in"}
                onClick={() => void runPasskey("sign-in")}
              >
                Sign in with a passkey
              </Button>
              <span className="pt-1 text-xs text-gold/60">Or sign in with a Starknet wallet</span>
            </>
          )}
          {connectors.map((connector) => (
            <Button
              key={connector.id}
              className="w-full !whitespace-normal px-4 py-2 leading-tight"
              disabled={pendingWallet !== null || status === "loading"}
              isLoading={pendingWallet === connector.id}
              onClick={() => void handleLogin(connector)}
            >
              {connector.name}
            </Button>
          ))}
          {connectors.length === 0 && <span>No Starknet wallets are available.</span>}
        </div>
      )}
      {error && <span className="max-w-[240px] text-center text-xs text-danger">{error}</span>}
    </div>
  );
};
