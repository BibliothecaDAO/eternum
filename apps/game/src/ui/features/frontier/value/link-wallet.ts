import { useQueries } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { useGame } from "@/hooks/context/game-context";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { requireActiveGame } from "@/runtime/world/store";
import { linkWalletHref } from "@/shell/profile/settings-route";
import { returnPathOf } from "@/shell/return-path";
import { environmentLedger } from "@/shell/value/ledger";
import { LINK_WALLET_FOR_LORDS } from "@/ui/design-system/kit/words";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { useRealmLords } from "./use-realm-lords";

/**
 * What an account with no linked wallet is told where it sees LORDS it is owed (owner, 31 October 2026, "agreed"): the
 * ledger pays a withdrawal to a linked wallet only, and holds an unpaid one until there is one (the season settles only
 * once every withdrawal is paid), so the line names no deadline. Null when the account has a linked wallet, nobody is
 * signed in (a spectator), or it is owed nothing.
 */
export const useLinkWalletPrompt = (owed: number | undefined): string | null => {
  const { session } = useIdentitySession();
  return session && payoutAddressOf(session.user) === null && owed ? LINK_WALLET_FOR_LORDS : null;
};

/**
 * The LORDS a realm's owner is owed in this game: what the realm holds, and what its withdrawals took out that the
 * ledger has not paid (one the player made, the season's sweep, a prize). Undefined until the realm's balance is known.
 */
export const useOwedLords = (realm: NativeRows["Structure"]): number | undefined => {
  const held = useRealmLords(realm);
  const unpaid = useUnpaidLords(BigInt(realm.owner));
  return held === undefined ? undefined : held + unpaid;
};

const RECEIPT_MODELS = ["LordsWithdrawal"] as const;

/**
 * The whole LORDS of an account's withdrawals the ledger has not paid: each receipt counts once the ledger answers that
 * it is unpaid, or at once where this environment has no ledger to pay it.
 */
const useUnpaidLords = (account: bigint): number => {
  const { setup } = useGame();
  useNativeRevision(RECEIPT_MODELS);
  const receipts = [...setup.store.inGame("LordsWithdrawal", configManager.getActiveGameId())].filter(
    (receipt) => receipt.account === account,
  );
  const ledger = environmentLedger();
  const shard = requireActiveGame().chainId;
  const paid = useQueries({
    queries: receipts.map(({ claim_id }) => ({
      queryKey: ["ledger", "payment", shard, String(claim_id)],
      queryFn: () => ledger!.paid(shard, String(claim_id)),
      enabled: ledger !== null,
    })),
  });
  return receipts.reduce(
    (sum, receipt, index) => (ledger === null || paid[index]!.data === false ? sum + Number(receipt.amount) : sum),
    0,
  );
};

/** Settings opened on the payout wallet, coming back to this page once one is linked. */
export const useLinkWallet = (): (() => void) => {
  const navigate = useNavigate();
  const location = useLocation();
  return () => navigate(linkWalletHref(returnPathOf(location)));
};
