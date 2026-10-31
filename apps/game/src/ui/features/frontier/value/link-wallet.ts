import { useLocation, useNavigate } from "react-router-dom";

import { useGame } from "@/hooks/context/game-context";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { linkWalletHref } from "@/shell/profile/settings-route";
import { returnPathOf } from "@/shell/return-path";
import { LINK_WALLET_FOR_LORDS, linkWalletBy } from "@/ui/design-system/kit/words";
import { configManager } from "@bibliothecadao/eternum";
import { formatMoment } from "@bibliothecadao/types";

import { withdrawalsCloseAt } from "./withdrawal";

/** A season's payout window: the game's end, and the second its withdrawals close. */
export type PayoutWindow = { endsAt: number; closesAt: number };

/**
 * What an account with no linked wallet is told where it sees its LORDS (owner, 31 October 2026, "agreed"): the season's
 * payout goes to a linked wallet only, so before the season ends it is told to link one to receive them; after, by
 * the moment withdrawals close, or the LORDS go to the next season. The window unknown, it is the first.
 */
export const linkWalletLine = (window: PayoutWindow | undefined, now: number): string =>
  window && now >= window.endsAt ? linkWalletBy(formatMoment(window.closesAt, now)) : LINK_WALLET_FOR_LORDS;

/** The line for this game, read from its facts and the clock. */
export const useLinkWalletLine = (): string => linkWalletLine(usePayoutWindow(), useNowSeconds());

/**
 * The line where the signed-in account sees `lords` it cannot receive: null when it has a linked wallet, nobody is
 * signed in (a spectator), or it holds no LORDS.
 */
export const useLinkWalletPrompt = (lords: number | undefined): string | null => {
  const { session } = useIdentitySession();
  const line = useLinkWalletLine();
  return session && payoutAddressOf(session.user) === null && lords ? line : null;
};

/** Settings opened on the payout wallet, coming back to this page once one is linked. */
export const useLinkWallet = (): (() => void) => {
  const navigate = useNavigate();
  const location = useLocation();
  return () => navigate(linkWalletHref(returnPathOf(location)));
};

const WINDOW_MODELS = ["GameRegistry", "ChestRules"] as const;

/** This season's payout window, from the game's end and its claim window; undefined until both are known. */
export const usePayoutWindow = (): PayoutWindow | undefined => {
  const { setup } = useGame();
  useNativeRevision(WINDOW_MODELS);
  const gameId = configManager.getActiveGameId();
  const game = setup.store.get("GameRegistry", { game_id: gameId });
  const chests = setup.store.get("ChestRules", { game_id: gameId });
  if (!game || !chests) return undefined;
  const endsAt = Number(game.end_at);
  return { endsAt, closesAt: withdrawalsCloseAt(endsAt, chests.claim_window_seconds) };
};
