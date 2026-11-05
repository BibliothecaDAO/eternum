import { VALUE_WORDS, WALLET_WORDS } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { StarknetProvider } from "@/hooks/context/starknet-provider";
import { shortAddress } from "@/ui/design-system/kit/address";
import { AppButton, AppNotice } from "@/ui/design-system/kit/app-elements";

import { isSameStarknetAddress, type DefaultWallet, type SignInOptions } from "@realms-world/identity";
import { useConnect, useDisconnect, useProvider } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLatest } from "@/hooks/use-latest";
import { useDefaultWallet } from "@/hooks/context/default-wallet";
import { l2Provider } from "@/runtime/l2-rpc";
import type { AccountInterface, Call, ProviderInterface } from "starknet";

import { Loading } from "@/shell/loading";
import { lordsCentsTextOf } from "@/shell/value/ledger";
import { NoStrkLine } from "@/shell/value/no-strk-line";
import { WalletUnread } from "@/shell/value/wallet-unread";

import { failureSentence, WrongNetworkError } from "@/ui/modules/identity/identity-failures";
import { assertWalletOnL2 } from "@/ui/modules/identity/l2-wallet";
import { connectorHolding, rememberOpened } from "@/ui/modules/identity/wallet-holder";
import { walletProofForAccount } from "@/ui/modules/identity/wallet-proof";
import {
  forgetUncertain,
  standingOf,
  uncertainSendOf,
  type UncertainSend,
} from "@/ui/modules/identity/uncertain-sends";
import {
  prepareDefaultWalletSend,
  sendFromDefaultWallet,
  sendFromWallet,
  submitSigned,
  type PreparedSend,
  type WalletFee,
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
 * signs instead, its network fee shown and paid in LORDS: no wallet opens and no STRK is needed.
 */
export const WalletSign = (props: { owner: string; calls: Call[]; onLanded: () => void }) => {
  const { wallet: defaultWallet, failed, retry } = useDefaultWallet();
  const uncertain = useUncertainSend(props.owner, JSON.stringify(props.calls), props.onLanded);
  if (defaultWallet === undefined) return failed ? <WalletUnread onRetry={retry} /> : <Loading />;
  if (uncertain.state.kind === "checking") return <Loading />;
  if (uncertain.state.kind === "pending") return <OnItsWay uncertain={uncertain} onLanded={props.onLanded} />;
  const lastFailed = uncertain.state.lastFailed;
  const send =
    defaultWallet && isSameStarknetAddress(defaultWallet.address, props.owner) ? (
      <PasskeySend
        wallet={defaultWallet}
        calls={props.calls}
        onLanded={props.onLanded}
        onUnconfirmed={uncertain.check}
      />
    ) : (
      <StarknetProvider>
        <OwnerSend {...props} onUnconfirmed={uncertain.check} />
      </StarknetProvider>
    );
  return (
    <>
      {lastFailed && <span className="text-app-label text-app-bad">{VALUE_WORDS.lastSendFailed}</span>}
      {send}
    </>
  );
};

/**
 * The wallet's uncertain send (uncertain-sends.ts), if any, asked of the chain before anything new is sent from it:
 * landed (the same send: done), failed or never sendable (forgotten, a new send may go), or still pending.
 */
const useUncertainSend = (owner: string, asked: string, onLanded: () => void) => {
  const [state, setState] = useState<
    { kind: "checking" } | { kind: "clear"; lastFailed: boolean } | { kind: "pending"; send: UncertainSend }
  >(() => (uncertainSendOf(owner) ? { kind: "checking" } : { kind: "clear", lastFailed: false }));
  const latest = useLatest({ asked, onLanded });
  /** Asks the chain where the send stands, and shows its answer once it comes. */
  const ask = useCallback(() => {
    const send = uncertainSendOf(owner);
    return (send ? standingOf(l2Provider(), send) : Promise.resolve(null)).then(
      (standing) => {
        if (!send || !standing) return setState({ kind: "clear", lastFailed: false });
        if (standing.kind === "pending") return setState({ kind: "pending", send });
        forgetUncertain(owner);
        if (standing.kind === "landed" && send.calls === latest.current.asked) return latest.current.onLanded();
        setState({ kind: "clear", lastFailed: standing.kind === "failed" });
      },
      (error: unknown) => {
        console.error("uncertain_send_check_failed", error);
        setState(send ? { kind: "pending", send } : { kind: "clear", lastFailed: false });
      },
    );
  }, [latest, owner]);
  /** Check again: the wait shows, then the chain's answer. */
  const check = useCallback(() => {
    setState({ kind: "checking" });
    return ask();
  }, [ask]);
  // The first check on open: the state already starts as checking when there is a send to ask about.
  useEffect(() => {
    if (uncertainSendOf(owner)) void ask();
  }, [ask, owner]);
  return { state, check };
};

/**
 * The last send's answer was lost, or its passkey was still asked when its panel closed: Check again asks the chain; a
 * default wallet's signed execution can be sent again as it is (its nonce lets it run once), and nothing new is offered
 * until it is settled.
 */
const OnItsWay = ({
  uncertain,
  onLanded,
}: {
  uncertain: ReturnType<typeof useUncertainSend>;
  onLanded: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = uncertain.state.kind === "pending" ? uncertain.state.send : null;
  const ownerSignature = send?.via === "passkey" ? send.ownerSignature : null;
  const again = async () => {
    if (send?.via !== "passkey" || !ownerSignature) return;
    setBusy(true);
    setError(null);
    try {
      const sent = await submitSigned({ ...send, ownerSignature }, l2Provider(), () => {}, "again");
      if (sent.kind === "landed") return onLanded();
    } catch (cause) {
      setError(failureSentence("send", cause));
    } finally {
      setBusy(false);
    }
    await uncertain.check();
  };
  return (
    <div className="flex w-full flex-col gap-2.5">
      <AppNotice line={VALUE_WORDS.onItsWay} />
      {error && <span className="text-app-label text-app-bad">{error}</span>}
      <AppButton kind="secondary" icon="refresh" disabled={busy} onClick={() => void uncertain.check()}>
        {VALUE_WORDS.checkAgain}
      </AppButton>
      {ownerSignature && (
        <AppButton
          kind="quiet"
          icon="lock"
          busy={busy ? VALUE_WORDS.confirming : undefined}
          onClick={() => void again()}
        >
          {VALUE_WORDS.sendAgain}
        </AppButton>
      )}
    </div>
  );
};

/** A prepared send is prepared again once it is this old, before the paymaster's time window can close on it. */
const PREPARED_FOR_MS = 60_000;

/** What the player sees before confirming: the send being prepared and priced, its fee, or why it could not be. */
type Priced = { kind: "pricing" } | { kind: "priced"; fee: WalletFee | null } | { kind: "unpriced"; line: string };

/**
 * The default wallet's send: prepared and priced as it opens (the paymaster builds it, this page checks it), its
 * network fee shown, then one tap on Confirm opens the passkey and sends. Nothing is signed before its fee was shown: a
 * press after the preparation went stale prepares again, and stops to show the new fee if it is over the one shown.
 */
const PasskeySend = ({
  wallet,
  calls,
  onLanded,
  onUnconfirmed,
}: {
  wallet: DefaultWallet;
  calls: Call[];
  onLanded: () => void;
  onUnconfirmed: () => void;
}) => {
  const prepared = useRef<{ send: Promise<PreparedSend>; at: number } | null>(null);
  const panelClosed = usePanelClosed();
  const [priced, setPriced] = useState<Priced>({ kind: "pricing" });
  const [state, setState] = useState<{ kind: "ready" | "signing" | "confirming" } | { kind: "failed"; line: string }>({
    kind: "ready",
  });
  // Callers build their calls on each render; the send is prepared again only when what they ask for changes.
  const asked = JSON.stringify(calls);
  const prepare = useCallback(() => {
    const send = prepareDefaultWalletSend(JSON.parse(asked) as Call[]);
    prepared.current = { send, at: Date.now() };
    send.then(
      ({ fee }) => prepared.current?.send === send && setPriced({ kind: "priced", fee }),
      (cause: unknown) =>
        prepared.current?.send === send && setPriced({ kind: "unpriced", line: failureSentence("send", cause) }),
    );
    return send;
  }, [asked]);
  useEffect(() => {
    void prepare().catch(() => {});
  }, [prepare]);
  const priceAgain = () => {
    setState({ kind: "ready" });
    setPriced({ kind: "pricing" });
    void prepare().catch(() => {});
  };
  const confirm = async (shown: WalletFee | null) => {
    const stale = !prepared.current || Date.now() - prepared.current.at > PREPARED_FOR_MS;
    const closed = panelClosed();
    setState({ kind: "signing" });
    try {
      const ready = await (stale ? prepare() : prepared.current!.send);
      if (feeRose(shown, ready.fee)) return setState({ kind: "failed", line: WALLET_WORDS.feeRose });
      const sent = await sendFromDefaultWallet(
        wallet,
        ready.execution,
        asked,
        l2Provider(),
        () => setState({ kind: "confirming" }),
        closed,
      );
      if (sent.kind === "abandoned") return;
      if (sent.kind === "landed") return onLanded();
      if (sent.kind === "unconfirmed") return onUnconfirmed();
      setState({ kind: "failed", line: sent.kind === "refused" ? sent.reason : VALUE_WORDS.refused });
    } catch (cause) {
      setState({ kind: "failed", line: failureSentence("send", cause) });
    }
    prepared.current = null;
  };
  if (priced.kind === "unpriced")
    return (
      <div className="flex w-full flex-col gap-2.5">
        <span className="text-app-label text-app-bad">{priced.line}</span>
        <AppButton kind="primary" icon="refresh" onClick={priceAgain}>
          {WALLET_WORDS.tryAgain}
        </AppButton>
      </div>
    );
  return (
    <div className="flex w-full flex-col gap-2.5">
      {state.kind === "failed" && <span className="text-app-label text-app-bad">{state.line}</span>}
      {priced.kind === "priced" && priced.fee && <FeeLine fee={priced.fee} />}
      <AppButton
        kind="primary"
        icon="lock"
        busy={
          priced.kind === "pricing"
            ? WALLET_WORDS.pricing
            : state.kind === "signing"
              ? WALLET_WORDS.confirmPasskey
              : state.kind === "confirming"
                ? VALUE_WORDS.confirming
                : undefined
        }
        onClick={() => priced.kind === "priced" && void confirm(priced.fee)}
      >
        {WALLET_WORDS.confirmPasskey}
      </AppButton>
    </div>
  );
};

/**
 * The signal a send carries for the panel that shows it, aborted once that panel closes: a send still being priced
 * then asks no wallet or passkey (wallet-send.ts). Made on each mount, so the development build's replayed effects
 * leave the mounted panel's signal live.
 */
const usePanelClosed = () => {
  const panel = useRef<AbortController | null>(null);
  useEffect(() => {
    const mounted = new AbortController();
    panel.current = mounted;
    return () => mounted.abort();
  }, []);
  return () => panel.current!.signal;
};

/** A fee built after the one shown that may take more than the player saw. */
const feeRose = (shown: WalletFee | null, built: WalletFee | null) =>
  built !== null && (shown === null || built.max > shown.max);

/** The network fee the default wallet pays itself: about its estimate, never more than its max. */
export const FeeLine = ({ fee }: { fee: WalletFee }) => (
  <span className="text-app-label text-app-muted">
    {WALLET_WORDS.networkFee(lordsCentsTextOf(fee.estimated, "up"), lordsCentsTextOf(fee.max, "up"))}
  </span>
);

const OwnerSend = ({
  owner,
  calls,
  onLanded,
  onUnconfirmed,
}: {
  owner: string;
  calls: Call[];
  onLanded: () => void;
  onUnconfirmed: () => void;
}) => {
  const { connectors } = useConnect();
  const [outcome, setOutcome] = useState<Exclude<WalletSendOutcome, { kind: "landed" }> | { kind: "confirming" }>();
  /** The connector holding `owner`: undefined while it is looked for, null when this browser has never opened it. */
  const [holder, setHolder] = useState<Connector | null>();
  const panelClosed = usePanelClosed();
  const send: OnAccount = async (account, _connectorId, provider) => {
    setOutcome(undefined);
    const sent = await sendFromWallet(
      account,
      owner,
      calls,
      provider,
      () => setOutcome({ kind: "confirming" }),
      panelClosed(),
    );
    if (sent.kind === "abandoned") return;
    if (sent.kind === "landed") onLanded();
    else if (sent.kind === "unconfirmed") onUnconfirmed();
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
