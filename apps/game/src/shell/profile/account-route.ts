import { nextOf, safeNextPath } from "../sign-in/sign-in-route";

/** Account's page. */
export const ACCOUNT_PATH = "/profile/account";

/**
 * Account opened to link the payout wallet from a page that needs one (a paid Blitz's lobby): it opens on the payout
 * wallet and returns to `next` once one is linked. The path is checked as sign-in checks its own.
 */
export const linkWalletHref = (next: string): string =>
  `${ACCOUNT_PATH}?next=${encodeURIComponent(safeNextPath(next))}`;

/** The page an Account visit was sent from to link a wallet, or null for a visit of its own. */
export const walletReturnOf = (search: string): string | null =>
  new URLSearchParams(search).has("next") ? nextOf(search) : null;
