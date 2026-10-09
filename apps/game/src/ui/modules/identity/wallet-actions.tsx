import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { StarknetProvider } from "@/hooks/context/starknet-provider";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import type { SignInOptions } from "@realms-world/identity";
import { useConnect, useDisconnect, useProvider } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCallback, useRef, useState } from "react";
import { addAddressPadding, constants, stark } from "starknet";

import { WALLET_WORDS } from "@/shell/words";

import { failureSentence, WrongNetworkError } from "./identity-failures";

/**
 * The wallets a Realms account links, in the order the picker lists them, each as the player knows it. A wallet whose
 * extension this browser lacks is not listed: a phone browser lists Ready by email and Controller.
 */
const WALLET_CHOICES = [
  { id: "argentX", name: WALLET_WORDS.ready, note: WALLET_WORDS.extension },
  { id: "argentWebWallet", name: WALLET_WORDS.ready, note: WALLET_WORDS.byEmail },
  { id: "braavos", name: WALLET_WORDS.braavos, note: WALLET_WORDS.extension },
  { id: "controller", name: WALLET_WORDS.controller, note: "" },
] as const;

type WalletId = (typeof WALLET_CHOICES)[number]["id"];

/**
 * The only surface with wallet connectors, loaded as its own chunk when a signed-in player links a wallet on the
 * account page. Nothing else loads a wallet, so signing in never starts one.
 */
export const WalletPicker = (props: WalletPickerProps) => (
  <StarknetProvider>
    <WalletRows {...props} />
  </StarknetProvider>
);

interface WalletPickerProps {
  /** The wallets offered; all of them when absent. */
  only?: readonly WalletId[];
  /** The chosen wallet, connected on mainnet, with the signature it will give when the link asks for one. */
  onProof: (proof: SignInOptions) => void;
}

const WalletRows = ({ only, onProof }: WalletPickerProps) => {
  const { connectors } = useConnect();
  const prove = useWalletProof();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const choose = async (connector: Connector) => {
    if (running.current) return;
    running.current = true;
    setPending(connector.id);
    setError(null);
    try {
      onProof(await prove(connector));
    } catch (cause) {
      setError(failureSentence("link", cause));
    } finally {
      running.current = false;
      setPending(null);
    }
  };

  const rows = WALLET_CHOICES.filter((choice) => !only || only.includes(choice.id)).flatMap((choice) => {
    const connector = connectors.find((candidate) => candidate.id === choice.id);
    return connector?.available() ? [{ choice, connector }] : [];
  });
  return (
    <div className="flex w-full flex-col gap-2.5">
      {rows.map(({ choice, connector }) => (
        <button
          key={choice.id}
          type="button"
          disabled={pending !== null}
          onClick={() => void choose(connector)}
          className="flex h-[62px] items-center gap-3 rounded-[14px] border-2 border-kit-line bg-kit-ground/60 px-3.5 text-left disabled:opacity-60"
        >
          <KitIcon code="Wt" size={34} />
          <span className="font-ui text-[21px] text-kit-cream">{choice.name}</span>
          {choice.note && <span className="font-body text-[13px] font-semibold text-kit-muted">{choice.note}</span>}
          <span className="ml-auto font-body text-[13px] text-kit-muted">
            {pending === choice.id ? WALLET_WORDS.opening : <KitIcon code="Ar" size={22} />}
          </span>
        </button>
      ))}
      {rows.length === 0 && <span className="font-body text-[15px] text-kit-muted">{WALLET_WORDS.noneHere}</span>}
      {error && <span className="font-body text-[14px] text-kit-red">{error}</span>}
    </div>
  );
};

/** The wallet's proof as the identity service reads it, from the connector the player just chose. */
const useWalletProof = () => {
  const { connectAsync, connector: connectedConnector } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { provider } = useProvider();
  return useCallback(
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
};

/**
 * The plain link, for an identity service that asks no email code: the chosen wallet is linked at once. It goes when
 * every identity service reports the payout wallet.
 */
export const WalletLink = () => {
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const [error, setError] = useState<string | null>(null);
  const link = async (proof: SignInOptions) => {
    setError(null);
    try {
      await identityClient.linkWallet(proof);
      await refresh();
    } catch (cause) {
      setError(failureSentence("link", cause));
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <WalletPicker onProof={(proof) => void link(proof)} />
      {error && <span className="font-body text-[14px] text-kit-red">{error}</span>}
    </div>
  );
};
