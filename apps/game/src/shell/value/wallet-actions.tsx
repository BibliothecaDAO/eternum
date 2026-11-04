import { VALUE_WORDS, WALLET_WORDS } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { StarknetProvider } from "@/hooks/context/starknet-provider";
import { shortAddress } from "@/ui/design-system/kit/address";
import { AppButton } from "@/ui/design-system/kit/app-elements";

import { isSameStarknetAddress, type DefaultWallet, type SignInOptions } from "@realms-world/identity";
import { useConnect, useDisconnect, useProvider } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLatest } from "@/hooks/use-latest";
import { useDefaultWallet } from "@/hooks/context/default-wallet";
import { l2Provider } from "@/runtime/l2-rpc";
import type { AccountInterface, Call, ProviderInterface, TypedData } from "starknet";

import { Loading } from "@/shell/loading";
import { NoStrkLine } from "@/shell/value/no-strk-line";

import { failureSentence, WrongNetworkError } from "@/ui/modules/identity/identity-failures";
import { assertWalletOnL2 } from "@/ui/modules/identity/l2-wallet";
import { connectorHolding, rememberOpened } from "@/ui/modules/identity/wallet-holder";
import { walletProofForAccount } from "@/ui/modules/identity/wallet-proof";
import {
  prepareDefaultWalletSend,
  sendFromDefaultWallet,
  sendFromWallet,
  type WalletSendOutcome,
  WrongWalletError,
} from "@/ui/modules/identity/wallet-send";

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
export const WalletPicker = (props: { onProof: (proof: SignInOptions) => void }) => (
  <StarknetProvider>
    <ProofRows {...props} />
  </StarknetProvider>
);

const ProofRows = ({ onProof }: { onProof: (proof: SignInOptions) => void }) => {
  const wallet = useWalletAction("link", async (account, connectorId, provider) =>
    onProof(await walletProofForAccount(account, provider, connectorId)),
  );
  return <WalletRows wallet={wallet} />;
};

/**
 * Where every send of the value screens passes: `owner` signs the ledger's calls (the payout wallet for a new entry,
 * the wallet that paid for anything it holds). The wallet is opened on the call itself, with no picking: the one that
 * holds `owner` in this browser is prompted at once, and any other account it answers with is refused, naming `owner`.
 * Only a wallet this browser has never opened is asked for, from the rows, once. A wallet with no STRK for the fee is
 * offered the swap instead; a sent call shows Confirming until its receipt lands, then `onLanded` (the panel reads the
 * ledger again), or the ledger's reason when it reverted. When `owner` is the account's default wallet, its passkey
 * signs instead and the sponsor pays: no wallet opens and no STRK is needed.
 */
export const WalletSign = (props: { owner: string; calls: Call[]; onLanded: () => void }) => {
  const defaultWallet = useDefaultWallet();
  if (defaultWallet === undefined) return <Loading />;
  if (defaultWallet && isSameStarknetAddress(defaultWallet.address, props.owner))
    return <PasskeySend wallet={defaultWallet} calls={props.calls} onLanded={props.onLanded} />;
  return (
    <StarknetProvider>
      <OwnerSend {...props} />
    </StarknetProvider>
  );
};

/** A prepared send is resent once it is this old, before the sponsor's time window can close on it. */
const PREPARED_FOR_MS = 60_000;

/**
 * The default wallet's send: prepared as it opens (the sponsor builds it, this page checks it), then one tap on
 * Confirm opens the passkey and sends. A press after the preparation went stale prepares again first.
 */
const PasskeySend = ({ wallet, calls, onLanded }: { wallet: DefaultWallet; calls: Call[]; onLanded: () => void }) => {
  const prepared = useRef<{ execution: Promise<TypedData>; at: number } | null>(null);
  const [state, setState] = useState<{ kind: "ready" | "signing" | "confirming" } | { kind: "failed"; line: string }>({
    kind: "ready",
  });
  // Callers build their calls on each render; the send is prepared again only when what they ask for changes.
  const asked = JSON.stringify(calls);
  const prepare = useCallback(() => {
    prepared.current = { execution: prepareDefaultWalletSend(JSON.parse(asked) as Call[]), at: Date.now() };
    prepared.current.execution.catch(() => {});
  }, [asked]);
  useEffect(() => {
    prepare();
  }, [prepare]);
  const confirm = async () => {
    if (!prepared.current || Date.now() - prepared.current.at > PREPARED_FOR_MS) prepare();
    setState({ kind: "signing" });
    try {
      const sent = await sendFromDefaultWallet(wallet, await prepared.current!.execution, l2Provider(), () =>
        setState({ kind: "confirming" }),
      );
      if (sent.kind === "landed") return onLanded();
      setState({ kind: "failed", line: sent.kind === "refused" ? sent.reason : VALUE_WORDS.refused });
    } catch (cause) {
      setState({ kind: "failed", line: failureSentence("send", cause) });
    }
    prepared.current = null;
  };
  return (
    <div className="flex w-full flex-col gap-2.5">
      {state.kind === "failed" && <span className="text-app-label text-app-bad">{state.line}</span>}
      <AppButton
        kind="primary"
        icon="lock"
        busy={
          state.kind === "signing"
            ? WALLET_WORDS.confirmPasskey
            : state.kind === "confirming"
              ? VALUE_WORDS.confirming
              : undefined
        }
        onClick={() => void confirm()}
      >
        {WALLET_WORDS.confirmPasskey}
      </AppButton>
    </div>
  );
};

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
  // Asked once, for the wallet this send was opened for.
  const opening = useLatest({ owner, connectors, wallet });
  const asked = useRef(false);
  useEffect(() => {
    // Development replays effects on mount: the wallet is still prompted once.
    if (asked.current) return;
    asked.current = true;
    const opened = opening.current;
    void connectorHolding(opened.owner, opened.connectors).then((found) => {
      setHolder(found ?? null);
      if (found) void opened.wallet.open(found);
    });
  }, [opening]);

  if (holder === undefined) return <Loading />;
  const confirming = outcome?.kind === "confirming";
  return (
    <div className="flex w-full flex-col gap-2.5">
      {outcome?.kind === "no-strk" && <NoStrkLine />}
      {outcome?.kind === "refused" && <span className="text-app-label text-app-bad">{outcome.reason}</span>}
      {holder === null && !confirming ? (
        <>
          <span className="text-app-label text-app-muted">{WALLET_WORDS.whichHolds(shortAddress(owner))}</span>
          <WalletRows wallet={wallet} />
        </>
      ) : (
        <>
          {wallet.error && <span className="text-app-label text-app-bad">{wallet.error}</span>}
          {wallet.pending !== null && !wallet.signing && (
            <span className="text-app-label text-app-muted">{WALLET_WORDS.confirmInWallet}</span>
          )}
          <AppButton
            kind="secondary"
            icon="refresh"
            busy={confirming ? VALUE_WORDS.confirming : wallet.signing ? WALLET_WORDS.confirmInWallet : undefined}
            onClick={() => holder && void wallet.open(holder)}
          >
            {WALLET_WORDS.tryAgain}
          </AppButton>
        </>
      )}
    </div>
  );
};

/** The opened wallet's account, connected on the build's L2, with its connector's id and the L2 provider. */
type OnAccount = (account: AccountInterface, connectorId: string, provider: ProviderInterface) => Promise<void>;

/**
 * One wallet action at a time: `open` connects a connector's wallet and hands its account to `onAccount`, `pending`
 * names the connector under way, `signing` says its account is in hand and being used, and `error` is the one line of
 * why it stopped. A wallet may never answer the connection (its window closed, or blocked by the browser), so a new
 * `open` while connecting starts over and the one it replaces is ignored; once an account is in hand, nothing else
 * starts until it is done, so nothing is signed or sent twice.
 */
const useWalletAction = (failure: "link" | "pay", onAccount: OnAccount) => {
  const { provider } = useProvider();
  const connect = useL2Account();
  const [pending, setPending] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const inHand = useRef(false);

  const open = async (connector: Connector) => {
    if (inHand.current) return;
    const attempt = ++latest.current;
    const current = () => attempt === latest.current;
    setPending(connector.id);
    setError(null);
    try {
      const account = await connect(connector);
      if (!current()) return;
      inHand.current = true;
      setSigning(true);
      await onAccount(account, connector.id, provider);
    } catch (cause) {
      if (current()) setError(walletFailureLine(failure, cause));
    } finally {
      if (current()) {
        inHand.current = false;
        setSigning(false);
        setPending(null);
      }
    }
  };
  return { open, pending, signing, error };
};

const walletFailureLine = (failure: "link" | "pay", cause: unknown) =>
  cause instanceof WrongWalletError ? WALLET_WORDS.wrongWallet(shortAddress(cause.owner)) : failureLine(failure, cause);

const WalletRows = ({ wallet }: { wallet: ReturnType<typeof useWalletAction> }) => {
  const { connectors } = useConnect();
  const rows = WALLET_CHOICES.flatMap((choice) => {
    const connector = connectors.find((candidate) => candidate.id === choice.id);
    return connector?.available() ? [{ choice, connector }] : [];
  });
  return (
    <div className="flex w-full flex-col gap-2.5">
      {rows.map(({ choice, connector }) => (
        <button
          key={choice.id}
          type="button"
          disabled={wallet.signing}
          onClick={() => void wallet.open(connector)}
          className="flex h-[62px] items-center gap-3 rounded-xl border border-app-line-strong bg-app-well px-3.5 text-left transition-colors hover:border-app-gold disabled:opacity-60"
        >
          <SemanticIcon name="backpack" size={34} />
          <span className="text-app-heading text-app-ink">{choice.name}</span>
          {choice.note && <span className="text-app-label text-app-muted">{choice.note}</span>}
          {wallet.pending === choice.id && (
            <span className="ml-auto text-app-label text-app-muted">{WALLET_WORDS.opening}</span>
          )}
        </button>
      ))}
      {rows.length === 0 && <span className="text-app-body text-app-muted">{WALLET_WORDS.noneHere}</span>}
      {wallet.pending !== null && !wallet.signing && (
        <span className="text-app-label text-app-muted">{WALLET_WORDS.nothingOpened}</span>
      )}
      {wallet.error && <span className="text-app-label text-app-bad">{wallet.error}</span>}
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
