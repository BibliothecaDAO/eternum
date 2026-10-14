import { StarknetProvider } from "@/hooks/context/starknet-provider";
import { shortAddress } from "@/ui/design-system/kit/address";
import { Button } from "@/ui/design-system/kit/button";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import type { SignInOptions } from "@realms-world/identity";
import { useConnect, useDisconnect, useProvider } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountInterface, Call, ProviderInterface } from "starknet";

import { Loading } from "@/shell/loading";
import { NoStrkLine } from "@/shell/value/no-strk-line";
import { VALUE_WORDS, WALLET_WORDS } from "@/shell/words";

import { failureSentence, WrongNetworkError } from "./identity-failures";
import { assertWalletOnL2 } from "./l2-wallet";
import { connectorHolding, rememberOpened } from "./wallet-holder";
import { walletProofForAccount } from "./wallet-proof";
import { sendFromWallet, type WalletSendOutcome, WrongWalletError } from "./wallet-send";

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
export const WalletPicker = (props: { only?: readonly WalletId[]; onProof: (proof: SignInOptions) => void }) => (
  <StarknetProvider>
    <ProofRows {...props} />
  </StarknetProvider>
);

const ProofRows = ({ only, onProof }: { only?: readonly WalletId[]; onProof: (proof: SignInOptions) => void }) => {
  const wallet = useWalletAction("link", async (account, connectorId, provider) =>
    onProof(await walletProofForAccount(account, provider, connectorId)),
  );
  return <WalletRows only={only} wallet={wallet} />;
};

/**
 * Where every send of the value screens passes: `owner` signs the ledger's calls (the payout wallet for a new entry,
 * the wallet that paid for anything it holds). The wallet is opened on the call itself, with no picking: the one that
 * holds `owner` in this browser is prompted at once, and any other account it answers with is refused, naming `owner`.
 * Only a wallet this browser has never opened is asked for, from the rows, once. A wallet with no STRK for the fee is
 * offered the swap instead; a sent call shows Confirming until its receipt lands, then `onLanded` (the panel reads the
 * ledger again), or the ledger's reason when it reverted.
 */
export const WalletSign = (props: { owner: string; calls: Call[]; onLanded: () => void }) => (
  <StarknetProvider>
    <OwnerSend {...props} />
  </StarknetProvider>
);

const OwnerSend = ({ owner, calls, onLanded }: { owner: string; calls: Call[]; onLanded: () => void }) => {
  const { connectors } = useConnect();
  const [outcome, setOutcome] = useState<Exclude<WalletSendOutcome, { kind: "landed" }> | { kind: "confirming" }>();
  /** The connector holding `owner`: undefined while it is looked for, null when this browser has never opened it. */
  const [holder, setHolder] = useState<Connector | null>();
  const send: OnAccount = async (account, _connectorId, provider) => {
    setOutcome(undefined);
    const sent = await sendFromWallet(account, owner, calls, provider, () => setOutcome({ kind: "confirming" }));
    if (sent.kind === "landed") onLanded();
    else setOutcome(sent);
  };
  const wallet = useWalletAction("pay", send);
  const asked = useRef(false);
  useEffect(() => {
    // Development replays effects on mount: the wallet is still prompted once.
    if (asked.current) return;
    asked.current = true;
    void connectorHolding(owner, connectors).then((found) => {
      setHolder(found ?? null);
      if (found) void wallet.open(found);
    });
    // Asked once, for the wallet this send was opened for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (holder === undefined) return <Loading />;
  const confirming = outcome?.kind === "confirming";
  return (
    <div className="flex w-full flex-col gap-2.5">
      {outcome?.kind === "no-strk" && <NoStrkLine />}
      {outcome?.kind === "refused" && <span className="font-body text-sm text-kit-red">{outcome.reason}</span>}
      {holder === null && !confirming ? (
        <>
          <span className="font-body text-sm text-kit-muted">{WALLET_WORDS.whichHolds(shortAddress(owner))}</span>
          <WalletRows wallet={wallet} />
        </>
      ) : (
        <>
          {wallet.error && <span className="font-body text-sm text-kit-red">{wallet.error}</span>}
          <Button
            role="outline"
            word={WALLET_WORDS.tryAgain}
            icon="Sp"
            loading={
              confirming ? VALUE_WORDS.confirming : wallet.pending === null ? undefined : WALLET_WORDS.confirmInWallet
            }
            onClick={() => holder && void wallet.open(holder)}
          />
        </>
      )}
    </div>
  );
};

type WalletId = (typeof WALLET_CHOICES)[number]["id"];

/** The opened wallet's account, connected on the build's L2, with its connector's id and the L2 provider. */
type OnAccount = (account: AccountInterface, connectorId: string, provider: ProviderInterface) => Promise<void>;

/**
 * One wallet action at a time: `open` connects a connector's wallet and hands its account to `onAccount`, `pending`
 * names the connector under way and `error` is the one line of why it stopped.
 */
const useWalletAction = (failure: "link" | "pay", onAccount: OnAccount) => {
  const { provider } = useProvider();
  const connect = useL2Account();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const open = async (connector: Connector) => {
    if (running.current) return;
    running.current = true;
    setPending(connector.id);
    setError(null);
    try {
      await onAccount(await connect(connector), connector.id, provider);
    } catch (cause) {
      setError(
        cause instanceof WrongWalletError
          ? WALLET_WORDS.wrongWallet(shortAddress(cause.owner))
          : failureLine(failure, cause),
      );
    } finally {
      running.current = false;
      setPending(null);
    }
  };
  return { open, pending, error };
};

const WalletRows = ({
  only,
  wallet,
}: {
  /** The wallets offered; all of them when absent. */
  only?: readonly WalletId[];
  wallet: ReturnType<typeof useWalletAction>;
}) => {
  const { connectors } = useConnect();
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
          disabled={wallet.pending !== null}
          onClick={() => void wallet.open(connector)}
          className="flex h-[62px] items-center gap-3 rounded-[14px] border-2 border-kit-line bg-kit-ground/60 px-3.5 text-left disabled:opacity-60"
        >
          <KitIcon code="Wt" size={34} />
          <span className="font-body text-xl text-kit-cream">{choice.name}</span>
          {choice.note && <span className="font-body text-sm font-semibold text-kit-muted">{choice.note}</span>}
          <span className="ml-auto font-body text-sm text-kit-muted">
            {wallet.pending === choice.id ? WALLET_WORDS.opening : <KitIcon code="Ar" size={22} />}
          </span>
        </button>
      ))}
      {rows.length === 0 && <span className="font-body text-base text-kit-muted">{WALLET_WORDS.noneHere}</span>}
      {wallet.error && <span className="font-body text-sm text-kit-red">{wallet.error}</span>}
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
      const account = await connector.account(provider);
      rememberOpened(account.address, connector.id);
      return account;
    },
    [connectAsync, connectedConnector, disconnectAsync, provider],
  );
};
