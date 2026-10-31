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
 * Whether a withdrawal receipt is still owed (owner, 31 October 2026: an unpaid no-wallet claim lapses at the claim
 * deadline and its LORDS carry to the next season): not once the ledger says it is paid, nor once it lapsed (the season
 * closed, or its claim deadline passed); otherwise it is, a receipt the ledger has not answered for included, so a
 * failed read never hides what the player is owed.
 */
const isOwed = (paid: boolean | undefined, claims: FrontierClaims | undefined, now: number): boolean =>
  paid !== true && !hasLapsed(claims, now);

/** Whether this season's unpaid claims have lapsed: the season closed on the ledger, or its claim deadline passed. */
const hasLapsed = (claims: FrontierClaims | undefined, now: number): boolean =>
  claims !== undefined && (claims.closed || now >= claims.deadline);

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
 * The whole LORDS of an account's withdrawals still owed (isOwed). Each one's payment is read again every L2 block, a
 * failed read too, until the ledger pays it or it lapses, so an open panel learns of the payment and recovers from a
 * ledger it could not read.
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
  const lapsed = hasLapsed(claims, now);
  const paid = useQueries({
    queries: receipts.map(({ claim_id }) => ({
      queryKey: ["ledger", "payment", shard, String(claim_id)],
      queryFn: () => ledger!.paid(shard, String(claim_id)),
      enabled: ledger !== null,
      refetchInterval: (query: { state: { data?: boolean } }) =>
        query.state.data !== true && !lapsed ? L2_BLOCK_MS : false,
    })),
  });
  if (ledger === null) return 0;
  return receipts.reduce(
    (sum, receipt, index) => (isOwed(paid[index]!.data, claims, now) ? sum + Number(receipt.amount) : sum),
    0,
  );
};

/**
 * This season's claims on the environment's ledger, read again every L2 block until it answers once (its deadline is
 * fixed; a close before it pays every claim, which the payment reads see); undefined while unread, or with no ledger.
 */
const useFrontierClaims = (): FrontierClaims | undefined => {
  const ledger = environmentLedger();
  const shard = requireActiveGame().chainId;
  const gameId = configManager.getActiveGameId();
  return useQuery({
    queryKey: ["ledger", "frontier-claims", shard, gameId],
    queryFn: () => ledger!.frontierClaims(shard, gameId),
    enabled: ledger !== null,
    refetchInterval: (query) => (query.state.data === undefined ? L2_BLOCK_MS : false),
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
