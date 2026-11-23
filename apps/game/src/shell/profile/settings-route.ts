import { nextOf, safeNextPath } from "../return-path";

export const PROFILE_PATH = "/profile";
export const DEVICES_PATH = `${PROFILE_PATH}#devices`;
export const DELETE_ACCOUNT_ID = "delete-account";
export const DELETE_ACCOUNT_PATH = `${PROFILE_PATH}#${DELETE_ACCOUNT_ID}`;
export const ACCOUNT_DELETION_PAGE = "/account/delete";

export const linkWalletHref = (next: string): string =>
  `${PROFILE_PATH}?next=${encodeURIComponent(safeNextPath(next))}#wallet`;

export const walletReturnOf = (search: string): string | null =>
  new URLSearchParams(search).has("next") ? nextOf(search) : null;
