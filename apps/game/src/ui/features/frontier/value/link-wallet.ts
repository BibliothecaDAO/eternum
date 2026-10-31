import { useQueries, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";

import { useGame } from "@/hooks/context/game-context";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { L2_BLOCK_MS } from "@/runtime/l2-rpc";
import { requireActiveGame } from "@/runtime/world/store";
import { linkWalletHref } from "@/shell/profile/settings-route";
import { returnPathOf } from "@/shell/return-path";
import { environmentLedger } from "@/shell/value/ledger";
import { LINK_WALLET_FOR_LORDS, linkWalletBy } from "@/ui/design-system/kit/words";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatMoment } from "@bibliothecadao/types";

import { useRealmLords } from "./use-realm-lords";

/** The season's claims on the ledger: when unpaid withdrawals lapse, and whether the season has closed. */
type FrontierClaims = { deadline: number; closed: boolean };

/**
 * A withdrawal receipt as the ledger holds it (owner, 31 October 2026: an unpaid no-wallet claim lapses at the claim
 * deadline and its LORDS carry to the next season): paid; void once the season closed, or its claim deadline passed
 * unpaid; else pending, still owed. Undefined until the ledger answers.
 */
export const receiptState = (
  paid: boolean | undefined,
  claims: FrontierClaims | undefined,
  now: number,
): "paid" | "pending" | "void" | undefined => {
  if (paid === undefined || claims === undefined) return undefined;
  if (paid) return "paid";
  return claims.closed || now >= claims.deadline ? "void" : "pending";
};

/**
 * What an account with no linked wallet is told where it sees LORDS it is owed: before the game's end, to link one to
 * receive them; after it, by the ledger's claim deadline, or they go to the next season. Unknown times leave the first.
 */
export const linkWalletLine = (deadline: number | undefined, endsAt: number | undefined, now: number): string =>
  deadline !== undefined && endsAt !== undefined && now >= endsAt
    ? linkWalletBy(formatMoment(deadline, now))
    : LINK_WALLET_FOR_LORDS;

/** The line for this game, from its end, the ledger's claim deadline and the clock. */
export const useLinkWalletLine = (): string =>
  linkWalletLine(useFrontierClaims()?.deadline, useGameEnd(), useNowSeconds());

/**
 * The line where the signed-in account sees `owed` LORDS it cannot receive: null when it has a linked wallet, nobody is
 * signed in (a spectator), or it is owed nothing.
 */
export const useLinkWalletPrompt = (owed: number | undefined): string | null => {
  const { session } = useIdentitySession();
  const line = useLinkWalletLine();
  return session && payoutAddressOf(session.user) === null && owed ? line : null;
};

/**
 * The LORDS a realm's owner is owed in this game: what the realm holds, and what its withdrawals took out that the
 * ledger still owes (one the player made, the season's sweep, a prize). Undefined until the realm's balance is known.
 */
export const useOwedLords = (realm: NativeRows["Structure"]): number | undefined => {
  const held = useRealmLords(realm);
  const pending = usePendingLords(BigInt(realm.owner));
  return held === undefined ? undefined : held + pending;
};

const RECEIPT_MODELS = ["LordsWithdrawal"] as const;

/**
 * The whole LORDS of an account's pending withdrawals (receiptState). An unpaid receipt's payment is read again each L2
 * block until the ledger pays it or it lapses, so an open panel learns of the payment.
 */
const usePendingLords = (account: bigint): number => {
  const { setup } = useGame();
  useNativeRevision(RECEIPT_MODELS);
  const now = useNowSeconds();
  const claims = useFrontierClaims();
  const receipts = [...setup.store.inGame("LordsWithdrawal", configManager.getActiveGameId())].filter(
    (receipt) => receipt.account === account,
  );
  const ledger = environmentLedger();
  const shard = requireActiveGame().chainId;
  const lapsed = receiptState(false, claims, now) === "void";
  const paid = useQueries({
    queries: receipts.map(({ claim_id }) => ({
      queryKey: ["ledger", "payment", shard, String(claim_id)],
      queryFn: () => ledger!.paid(shard, String(claim_id)),
      enabled: ledger !== null,
      refetchInterval: (query: { state: { data?: boolean } }) =>
        query.state.data === false && !lapsed ? L2_BLOCK_MS : false,
    })),
  });
  return receipts.reduce(
    (sum, receipt, index) =>
      receiptState(paid[index]!.data, claims, now) === "pending" ? sum + Number(receipt.amount) : sum,
    0,
  );
};

/** This season's claims on the environment's ledger; undefined while unread, or where there is no ledger. */
const useFrontierClaims = (): FrontierClaims | undefined => {
  const ledger = environmentLedger();
  const shard = requireActiveGame().chainId;
  const gameId = configManager.getActiveGameId();
  return useQuery({
    queryKey: ["ledger", "frontier-claims", shard, gameId],
    queryFn: () => ledger!.frontierClaims(shard, gameId),
    enabled: ledger !== null,
  }).data;
};

const GAME_MODELS = ["GameRegistry"] as const;

/** The game's end, as its registry holds it; undefined until read. */
const useGameEnd = (): number | undefined => {
  const { setup } = useGame();
  useNativeRevision(GAME_MODELS);
  const game = setup.store.get("GameRegistry", { game_id: configManager.getActiveGameId() });
  return game ? Number(game.end_at) : undefined;
};

/** Settings opened on the payout wallet, coming back to this page once one is linked. */
export const useLinkWallet = (): (() => void) => {
  const navigate = useNavigate();
  const location = useLocation();
  return () => navigate(linkWalletHref(returnPathOf(location)));
};
