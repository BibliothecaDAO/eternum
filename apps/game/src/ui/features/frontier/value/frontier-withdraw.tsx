import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useGame } from "@/hooks/context/game-context";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { L2_BLOCK_MS, l2TransactionUrl } from "@/runtime/l2-rpc";
import { requireActiveGame } from "@/runtime/world/store";
import { type EnvironmentLedger, environmentLedger } from "@/shell/value/ledger";
import { useLedgerPaused } from "@/shell/value/use-ledger-paused";
import { isDefinitelyNotApplied, type SentCommand, untilApplied } from "@/sync/action-outcome";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { configManager } from "@bibliothecadao/eternum";
import { type NativeRows, safeInteger } from "@bibliothecadao/eternum/game-client";

import { useLinkWallet } from "./link-wallet";
import { useRealmLords } from "./use-realm-lords";
import { WithdrawSheet } from "./withdraw-sheet";
import {
  type SentWithdrawal,
  type WithdrawalOutcome,
  withdrawalRefusal,
  withdrawalsCloseAt,
  withdrawStepOf,
} from "./withdrawal";

/**
 * Withdraw over the game's facts: the realm's LORDS, the account's payout wallet, and one withdrawal at a time. The
 * shard debits the realm and records the withdrawal, followed to its outcome; the ledger's payment of an applied
 * withdrawal's claim, read until it lands, is the relay's doing. Closing the sheet forgets a withdrawal on its way: the
 * realm's count and the wallet are its record.
 */
export const FrontierWithdraw = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const { setup, account } = useGame();
  const linkWallet = useLinkWallet();
  const { session } = useIdentitySession();
  const ledger = environmentLedger();
  const [amount, setAmount] = useState(0);
  const [sending, setSending] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<WithdrawalOutcome | null>(null);
  const paused = useLedgerPaused(ledger);
  const paidIn = usePaymentTransaction(ledger, outcome?.kind === "applied" ? outcome : null);
  const refusal = withdrawalRefusal({
    closesAt: useWithdrawalsCloseAt(),
    now: useNowSeconds(),
    ledgerReadable: ledger !== null,
    paused,
  });
  const held = useRealmLords(realm);
  if (!session) return null;

  const withdraw = async () => {
    const signer = account.account;
    if (!signer || !ledger) return;
    setSending(amount);
    setOutcome(null);
    const send = () => setup.systemCalls.withdraw_lords({ signer, structureId: safeInteger(realm.entity_id), amount });
    setOutcome(await sendWithdrawal(ledger, amount, send));
    setSending(null);
  };

  return (
    <WithdrawSheet
      held={held}
      wallet={payoutAddressOf(session.user)}
      refusal={refusal}
      step={withdrawStepOf({ sending, outcome, paidIn, paused })}
      amount={amount}
      onAmount={setAmount}
      onWithdraw={() => void withdraw()}
      onLinkWallet={linkWallet}
      onClose={onClose}
    />
  );
};

/**
 * One withdrawal sent and followed to the game's outcome (untilApplied): applied, with its claim and the ledger block
 * that bounds the search for its payment; not applied, with the reason; or unknown, when no answer came, never sent
 * again from here.
 */
const sendWithdrawal = async (
  ledger: EnvironmentLedger,
  amount: number,
  send: () => Promise<SentCommand>,
): Promise<WithdrawalOutcome> => {
  let fromBlock: number;
  try {
    // The ledger's block now bounds the search for this claim's payment: it cannot be paid before it is made.
    fromBlock = await ledger.latestBlock();
  } catch (error) {
    return { kind: "not-applied", reason: extractReadableErrorMessage(error) };
  }
  try {
    return { kind: "applied", amount, claimId: await untilApplied(send()), fromBlock };
  } catch (error) {
    return isDefinitelyNotApplied(error)
      ? { kind: "not-applied", reason: extractReadableErrorMessage(error) }
      : { kind: "unknown", amount };
  }
};

const CLOSE_MODELS = ["GameRegistry", "ChestRules"] as const;

/** When this season's withdrawals close, from the game's end and its claim window; undefined until both are known. */
const useWithdrawalsCloseAt = (): number | undefined => {
  const { setup } = useGame();
  useNativeRevision(CLOSE_MODELS);
  const gameId = configManager.getActiveGameId();
  const game = setup.store.get("GameRegistry", { game_id: gameId });
  const chests = setup.store.get("ChestRules", { game_id: gameId });
  return game && chests ? withdrawalsCloseAt(Number(game.end_at), chests.claim_window_seconds) : undefined;
};

/**
 * The explorer's address of the Starknet transaction that paid a sent withdrawal: its WithdrawalPaid event, which the
 * ledger emits only as it pays, read each block until it is there.
 */
const usePaymentTransaction = (ledger: EnvironmentLedger | null, sent: SentWithdrawal | null): string | undefined =>
  useQuery({
    queryKey: ["ledger", "withdrawal", sent?.claimId],
    queryFn: () => readPaymentTransaction(ledger as EnvironmentLedger, sent as SentWithdrawal),
    enabled: ledger !== null && sent !== null,
    refetchInterval: (query) => (query.state.data ? false : L2_BLOCK_MS),
  }).data ?? undefined;

const readPaymentTransaction = async (ledger: EnvironmentLedger, sent: SentWithdrawal): Promise<string | null> => {
  const transaction = await ledger.paymentTransaction(requireActiveGame().chainId, sent.claimId, sent.fromBlock);
  return transaction && l2TransactionUrl(transaction);
};
