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
}

export const IdentityLogin = ({ className = "" }: IdentityLoginProps) => {
  const { connectAsync, connectors, connector: connectedConnector } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { provider } = useProvider();
  const { status, session } = useIdentitySession();
  const applySession = useIdentitySessionStore((state) => state.applySession);
  const [error, setError] = useState<string | null>(null);
  const [pendingWallet, setPendingWallet] = useState<string | null>(null);
  const signingIn = useRef(false);

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
        const nextSession = await identityClient.signIn({
          address: addAddressPadding(account.address),
          chainId: "SN_MAIN",
          domain: new URL(identityOrigin).host,
          uri: identityOrigin,
          signTypedData: async (message) => stark.formatSignature(await account.signMessage(message)),
        });
        applySession(nextSession);
      } catch (loginError) {
        const message = loginError instanceof Error ? loginError.message : "Identity login failed";
        console.error("identity_login_failed", { error: message });
        setError(message);
      } finally {
        signingIn.current = false;
        setPendingWallet(null);
      }
    },
    [applySession, connectAsync, connectedConnector, disconnectAsync, provider],
  );

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {status === "signed-in" && session ? (
        <span>{shortAddress(session.user.id)}</span>
      ) : (
        <div className="flex w-full flex-col gap-1">
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

const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;
