import { lazy, Suspense, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatCharge, formatExact } from "@bibliothecadao/types";
import type { WalletSendOutcome } from "@/ui/modules/identity/wallet-send";
import { depositCalls, wholeLords, type LordsDeposit } from "@realms-world/value-ledger/deposits";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useGame } from "@/hooks/context/game-context";
import { requireActiveGame } from "@/runtime/world/store";
import { L2_CHAIN, L2_BLOCK_MS } from "@/runtime/l2-rpc";
import { environmentLedger } from "@/shell/value/ledger";
import { useLedgerPaused } from "@/shell/value/use-ledger-paused";
import { HudButton, HudField, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { useRealmLords } from "./use-realm-lords";
import { useSpendLords } from "./use-spend-lords";
import { useLinkWallet } from "./link-wallet";
import { FrontierWithdraw } from "./frontier-withdraw";

const WalletSign = lazy(() =>
  import("@/shell/value/wallet-actions").then(({ WalletSign }) => ({ default: WalletSign })),
);

/** The purse separates earned withdrawals from deposited, spend-only LORDS and their delivery receipts. */
export function FrontierPurse({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) {
  const purchased = useSpendLords(realm);
  const earned = useRealmLords(realm);
  const [withdraw, setWithdraw] = useState(false);
  const { session } = useIdentitySession();
  const wallet = session ? payoutAddressOf(session.user) : null;
  const ledger = environmentLedger();
  const attemptKey = `lords-deposit:${L2_CHAIN.id}:${ledger?.address}:${requireActiveGame().chainId}:${realm.game_id}:${realm.owner}:${wallet}`;
  if (!purchased.source || withdraw) return <FrontierWithdraw realm={realm} onClose={onClose} />;
  return (
    <HudSheet label="LORDS" onClose={onClose}>
      <p data-earned-lords={earned}>Winnings: {formatExact(earned)} LORDS</p>
      <p data-spend-lords={(purchased.balance?.available ?? 0n).toString()}>
        Spend-only: {formatExact(purchased.balance?.available ?? 0n)} LORDS
      </p>
      {purchased.balance && purchased.balance.swept > 0n && (
        <p>{formatExact(purchased.balance.swept)} LORDS released for return to your linked wallet.</p>
      )}
      <p>
        Deposits buy stamina refills. Unused deposits return to your linked wallet at season end. Undelivered deposits
        return to the paying wallet.
      </p>
      <DepositForm key={attemptKey} realm={realm} attemptKey={attemptKey} />
      <HudButton kind="quiet" onClick={() => setWithdraw(true)}>
        Withdraw winnings
      </HudButton>
    </HudSheet>
  );
}

function DepositForm({ realm, attemptKey }: { realm: NativeRows["Structure"]; attemptKey: string }) {
  const { setup } = useGame();
  const { session } = useIdentitySession();
  const linkWallet = useLinkWallet();
  const purchased = useSpendLords(realm);
  useNativeRevision(["GameRegistry"]);
  const gameId = configManager.getActiveGameId();
  const game = setup.store.get("GameRegistry", { game_id: gameId });
  const now = useNowSeconds();
  const ledger = environmentLedger();
  const paused = useLedgerPaused(ledger);
  const wallet = session ? payoutAddressOf(session.user) : null;
  const [amount, setAmount] = useState("10");
  const chainId = requireActiveGame().chainId;
  const [payment, setPayment] = useState<{ amount: string; request: string } | null>(() => {
    const saved = localStorage.getItem(attemptKey);
    return saved ? JSON.parse(saved) : null;
  });
  const [phase, setPhase] = useState<"idle" | "sending" | "uncertain">(() => (payment ? "uncertain" : "idle"));
  const uncertain = useRef(payment !== null);
  const [resume, setResume] = useState(false);
  const [landed, setLanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useQuery({
    queryKey: ["deposit-token", ledger?.address],
    queryFn: () => ledger!.lordsToken(),
    enabled: !!ledger,
  });
  const history = useQuery({
    queryKey: ["deposits", chainId, realm.owner.toString()],
    queryFn: () => readDeposits(chainId),
    refetchInterval: L2_BLOCK_MS,
  });
  const source = purchased.source;
  const ready =
    !!source &&
    !!ledger &&
    BigInt(source.chain) === BigInt(L2_CHAIN.id) &&
    BigInt(source.ledger) === BigInt(ledger.address) &&
    paused === false &&
    !!game &&
    now >= Number(game.start_main_at) &&
    now < Number(game.end_at);
  const begin = () => {
    try {
      wholeLords(amount);
      const next = { amount, request: `0x${crypto.randomUUID().replaceAll("-", "")}` };
      localStorage.setItem(attemptKey, JSON.stringify(next));
      uncertain.current = false;
      setResume(true);
      setError(null);
      setLanded(false);
      setPhase("sending");
      setPayment(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid amount");
    }
  };
  const clearAttempt = () => {
    localStorage.removeItem(attemptKey);
    setPayment(null);
    setPhase("idle");
    uncertain.current = false;
    setResume(false);
  };
  const walletState = (state: "idle" | "sending" | WalletSendOutcome) => {
    if (typeof state === "string") {
      setPhase(state === "idle" && uncertain.current ? "uncertain" : state);
      return;
    }
    if (state.kind === "landed") {
      clearAttempt();
      setLanded(true);
      void history.refetch();
    } else {
      if (state.kind === "uncertain") uncertain.current = true;
      setPhase(uncertain.current ? "uncertain" : "idle");
    }
  };
  return (
    <>
      {!ready && <p>Deposits are unavailable until this season is live and its ledger is ready.</p>}
      {!wallet ? (
        <HudButton kind="primary" onClick={linkWallet}>
          Link a wallet to deposit
        </HudButton>
      ) : (
        <>
          <HudField
            icon="lords"
            aria-label="Whole LORDS to deposit"
            inputMode="numeric"
            value={payment?.amount ?? amount}
            disabled={!!payment}
            onChange={setAmount}
          />
          <p>1 wallet LORDS = 1 spend-only LORDS. Your wallet also pays the Starknet network fee in STRK.</p>
          {error && <p role="alert">{error}</p>}
          {!payment && (
            <HudButton kind="primary" disabled={!ready || !token.data} onClick={begin}>
              Deposit LORDS
            </HudButton>
          )}
          {payment && resume && !landed && ledger && token.data && session && (
            <Suspense fallback={<p>Opening wallet…</p>}>
              <WalletSign
                key={payment.request}
                onState={walletState}
                owner={wallet}
                calls={depositCalls(
                  ledger.address,
                  token.data,
                  {
                    shard: chainId,
                    gameId,
                    account: String(realm.owner),
                    realmsId: session.user.realmsId,
                    home: String(realm.entity_id),
                  },
                  payment.amount,
                  payment.request,
                )}
                onLanded={() => {}}
              />
            </Suspense>
          )}
          {payment && !resume && (
            <HudButton
              kind="primary"
              onClick={() => {
                setResume(true);
                setPhase("sending");
              }}
            >
              Retry payment
            </HudButton>
          )}
          {payment && phase === "idle" && (
            <HudButton kind="quiet" onClick={clearAttempt}>
              Edit or cancel deposit
            </HudButton>
          )}
          {payment && phase === "uncertain" && (
            <p role="status">Payment status is uncertain. Retry this same payment to avoid a second deposit.</p>
          )}
          {landed && <p role="status">Payment confirmed. Waiting for the spend-only credit.</p>}
        </>
      )}
      {history.isError && (
        <p>Deposit history is temporarily unavailable. Your balance above remains the game's synced balance.</p>
      )}
      {history.data?.map((receipt) => (
        <p key={receipt.id} data-deposit-id={receipt.id} role="status">
          {formatCharge(Number(receipt.amount))} LORDS · {depositStatus(receipt, purchased.receipts)}
        </p>
      ))}
    </>
  );
}

function depositStatus(receipt: LordsDeposit, native: readonly NativeRows["DepositReceipt"][]) {
  const row = native.find((row) => row.game_id === receipt.gameId && row.id === BigInt(receipt.id));
  if (receipt.status === "cancelled") return "Refunded to paying wallet";
  if (row && !row.cancelled) return "Credited";
  if (row?.cancelled) return "Cancelled · refund pending";
  return receipt.status === "delivered" ? "Credited · syncing balance" : "Payment confirmed · credit pending";
}

async function readDeposits(chainId: string): Promise<LordsDeposit[]> {
  const rows: LordsDeposit[] = [];
  let before: string | null = null;
  do {
    const query = new URLSearchParams({ chainId, ...(before ? { before } : {}) });
    const response = await fetch(`/api/value/deposits?${query}`, { credentials: "include" });
    if (!response.ok) throw new Error("deposit_history_unavailable");
    const page = (await response.json()) as { rows: LordsDeposit[]; next: string | null };
    rows.push(...page.rows);
    before = page.next;
  } while (before);
  return rows;
}
