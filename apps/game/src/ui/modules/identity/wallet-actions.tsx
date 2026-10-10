import { StarknetProvider } from "@/hooks/context/starknet-provider";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import type { SignInOptions } from "@realms-world/identity";
import { useConnect, useDisconnect, useProvider } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCallback, useRef, useState } from "react";
import type { AccountInterface, Call, ProviderInterface } from "starknet";

import { WALLET_WORDS } from "@/shell/words";

import { failureSentence, WrongNetworkError } from "./identity-failures";
import { assertWalletOnL2 } from "./l2-wallet";
import { walletProofForAccount } from "./wallet-proof";

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

/**
 * The only surface with wallet connectors, loaded as its own chunk when a signed-in player links a wallet or pays from
 * it. Nothing else loads a wallet, so signing in never starts one.
 */
export const WalletPicker = ({
  only,
  onProof,
}: {
  only?: readonly WalletId[];
  onProof: (proof: SignInOptions) => void;
}) => (
  <StarknetProvider>
    <WalletRows
      only={only}
      failure="link"
      onAccount={async (account, connectorId, provider) =>
        onProof(await walletProofForAccount(account, provider, connectorId))
      }
    />
  </StarknetProvider>
);

/**
 * The payout wallet signs the ledger's calls: the player opens it from the same rows, and a wallet that is not the
 * one linked in Account is refused before anything is sent.
 */
export const WalletSign = ({
  owner,
  calls,
  onSent,
}: {
  owner: string;
  calls: Call[];
  onSent: (transactionHash: string) => void;
}) => (
  <StarknetProvider>
    <WalletRows
      failure="pay"
      onAccount={async (account) => {
        if (!sameAddress(account.address, owner)) throw new NotPayoutWalletError();
        onSent((await account.execute(calls)).transaction_hash);
      }}
    />
  </StarknetProvider>
);

class NotPayoutWalletError extends Error {}

const sameAddress = (one: string, other: string) => BigInt(one) === BigInt(other);

type WalletId = (typeof WALLET_CHOICES)[number]["id"];

const WalletRows = ({
  only,
  failure,
  onAccount,
}: {
  /** The wallets offered; all of them when absent. */
  only?: readonly WalletId[];
  failure: "link" | "pay";
  /** The chosen wallet's account, connected on the build's L2, with its connector's id and the L2 provider. */
  onAccount: (account: AccountInterface, connectorId: string, provider: ProviderInterface) => Promise<void>;
}) => {
  const { connectors } = useConnect();
  const { provider } = useProvider();
  const connect = useL2Account();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const choose = async (connector: Connector) => {
    if (running.current) return;
    running.current = true;
    setPending(connector.id);
    setError(null);
    try {
      await onAccount(await connect(connector), connector.id, provider);
    } catch (cause) {
      setError(cause instanceof NotPayoutWalletError ? WALLET_WORDS.notPayoutWallet : failureLine(failure, cause));
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

const failureLine = (failure: "link" | "pay", cause: unknown) => {
  if (failure === "link") return failureSentence("link", cause);
  console.error("wallet_payment_failed", { error: cause instanceof Error ? cause.message : cause });
  return cause instanceof WrongNetworkError ? failureSentence("link", cause) : WALLET_WORDS.paymentFailed;
};

/** The chosen wallet, connected and on the build's L2. */
const useL2Account = () => {
  const { connectAsync, connector: connectedConnector } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { provider } = useProvider();
  return useCallback(
    async (connector: Connector): Promise<AccountInterface> => {
      if (connectedConnector) await disconnectAsync();
      await connectAsync({ connector });
      assertWalletOnL2(await connector.chainId());
      // Use the selected connector immediately; React's account state may still describe the previous wallet.
      return connector.account(provider);
    },
    [connectAsync, connectedConnector, disconnectAsync, provider],
  );
};
