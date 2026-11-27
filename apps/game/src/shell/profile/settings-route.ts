import { COSMETICS_HASH } from "../cosmetics/cosmetics-route";
import { nextOf, safeNextPath } from "../return-path";

export type ProfileHubTab = "overview" | "cosmetics" | "referrals" | "wallet" | "settings";

export const PROFILE_PATH = "/profile";
const WALLET_HASH = "#wallet";
export const WALLET_PATH = `${PROFILE_PATH}${WALLET_HASH}`;
export const DEVICES_PATH = `${PROFILE_PATH}#devices`;
const DEVICES_HASH = DEVICES_PATH.slice(PROFILE_PATH.length);
export const DELETE_ACCOUNT_ID = "delete-account";
export const DELETE_ACCOUNT_PATH = `${PROFILE_PATH}#${DELETE_ACCOUNT_ID}`;
const DELETE_ACCOUNT_HASH = DELETE_ACCOUNT_PATH.slice(PROFILE_PATH.length);
export const ACCOUNT_DELETION_PAGE = "/account/delete";

export const PROFILE_TAB_HASH: Record<ProfileHubTab, string> = {
  overview: "#realms",
  cosmetics: COSMETICS_HASH,
  referrals: "#referrals",
  wallet: WALLET_HASH,
  settings: "#settings",
};

const PROFILE_TAB_BY_HASH = new Map<string, ProfileHubTab>([
  ...(Object.entries(PROFILE_TAB_HASH) as [ProfileHubTab, string][]).map(([tab, hash]) => [hash, tab] as const),
  [DEVICES_HASH, "wallet"],
  [DELETE_ACCOUNT_HASH, "settings"],
]);

export const hubTabFromLocation = (hash: string, search: string): ProfileHubTab =>
  PROFILE_TAB_BY_HASH.get(hash) ?? (nextOf(search) !== null ? "wallet" : "overview");

export const isWalletTabLocation = (pathname: string, hash: string, search: string): boolean =>
  (pathname === PROFILE_PATH || pathname.endsWith(PROFILE_PATH)) && hubTabFromLocation(hash, search) === "wallet";

export const linkWalletHref = (next: string): string =>
  `${PROFILE_PATH}?next=${encodeURIComponent(safeNextPath(next))}${WALLET_HASH}`;
