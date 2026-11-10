import { nextOf, safeNextPath } from "../return-path";

/** Settings, under You: the account, the payout wallet, notifications, music, devices and deletion, on one page. */
export const SETTINGS_PATH = "/profile/settings";
export const DEVICES_PATH = `${SETTINGS_PATH}#devices`;
/** Settings' Delete account row, which the public account deletion page links to. */
export const DELETE_ACCOUNT_ID = "delete-account";
export const DELETE_ACCOUNT_PATH = `${SETTINGS_PATH}#${DELETE_ACCOUNT_ID}`;
/** The public page that explains account deletion and links to that row: the web address the stores ask for. */
export const ACCOUNT_DELETION_PAGE = "/account/delete";

/**
 * Settings opened to link the payout wallet from a page that needs one (a paid Blitz's lobby): it opens on the payout
 * wallet and returns to `next` once one is linked. The path is checked as every detour's is.
 */
export const linkWalletHref = (next: string): string =>
  `${SETTINGS_PATH}?next=${encodeURIComponent(safeNextPath(next))}`;

/** The page a Settings visit was sent from to link a wallet, or null for a visit of its own. */
export const walletReturnOf = (search: string): string | null =>
  new URLSearchParams(search).has("next") ? nextOf(search) : null;
