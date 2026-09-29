import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { StarknetProvider } from "@/hooks/context/starknet-provider";
import Button from "@/ui/design-system/atoms/button";
import type { SignInOptions } from "@realms-world/identity";
import { useConnect, useDisconnect, useProvider } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCallback, useRef, useState } from "react";
import { addAddressPadding, constants, stark } from "starknet";

import { failureSentence, WrongNetworkError } from "./identity-failures";

/**
 * The only surface with wallet connectors, loaded as its own chunk when a signed-in player links a wallet on the
 * account page. Nothing else loads a wallet, so signing in never starts one.
 */
export const WalletLink = () => (
  <StarknetProvider>
    <WalletConnectors />
  </StarknetProvider>
);

const WalletConnectors = () => {
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const { connectAsync, connectors, connector: connectedConnector } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { provider } = useProvider();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  /** The wallet's proof as the identity service reads it, from the connector the player just chose. */
  const walletProof = useCallback(
    async (connector: Connector): Promise<SignInOptions> => {
      if (connectedConnector) await disconnectAsync();
      await connectAsync({ connector });
      if ((await connector.chainId()) !== BigInt(constants.StarknetChainId.SN_MAIN)) throw new WrongNetworkError();
      // Use the selected connector immediately; React's account state may still describe the previous wallet.
      const account = await connector.account(provider);
      return {
        address: addAddressPadding(account.address),
        chainId: "SN_MAIN",
        domain: window.location.host,
        uri: window.location.origin,
        signTypedData: async (message) =>
          stark.formatSignature(await account.signMessage(message as Parameters<typeof account.signMessage>[0])),
      };
    },
    [connectAsync, connectedConnector, disconnectAsync, provider],
  );

  const linkWallet = async (connector: Connector) => {
    if (running.current) return;
    running.current = true;
    setPending(connector.id);
    setError(null);
    try {
      await identityClient.linkWallet(await walletProof(connector));
      await refresh();
    } catch (cause) {
      setError(failureSentence("link", cause));
    } finally {
      running.current = false;
      setPending(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-1">
      {connectors.map((connector) => (
        <Button
          key={connector.id}
          className="w-full !whitespace-normal px-4 py-2 leading-tight"
          disabled={pending !== null}
          isLoading={pending === connector.id}
          onClick={() => void linkWallet(connector)}
        >
          {connector.name}
        </Button>
      ))}
      {connectors.length === 0 && <span className="text-xs text-gold/60">No Starknet wallets are available.</span>}
      {error && <span className="max-w-[240px] text-xs text-danger">{error}</span>}
    </div>
  );
};
