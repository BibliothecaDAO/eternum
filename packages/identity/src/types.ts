import type { PayoutWallet } from "./payout-wallet";
export interface IdentityUser {
  id: string;
  /** The Realms account's on-chain id; notifications, profiles and gameplay accounts are keyed by it. */
  realmsId: string;
  payoutWallet?: PayoutWallet;
  ledgerLink?: LedgerLinkStatus;
  walletLinkedAt?: number | null;
  address?: string | null;
  name: string;
  email: string;
  /** Whether the player signed in with a code sent to `email`, so the address is theirs. */
  emailVerified?: boolean;
  /** The display name offered before the player chooses one, from their Discord name or their email. */
  suggestedName?: string | null;
  /** The chosen portrait id ("01".."12"), or null before the user picks one. */
  image?: string | null;
}

/** What identity knows about a player in public: the chosen name and portrait, or nulls before they chose. */
export interface IdentityProfile {
  name: string | null;
  portrait: string | null;
}

export interface IdentitySessionRecord {
  id: string;
  expiresAt: string | Date;
  userId: string;
}

export interface Session {
  session: IdentitySessionRecord;
  user: IdentityUser;
}

export type IdentityChainId = "SN_MAIN" | "SN_SEPOLIA";

/** A current identity reconciliation target; null clears that side of the ledger's bijection. */
export interface AccountLinkTarget {
  key: string;
  realmsId: string;
  wallet: string | null;
  account: string | null;
  historyId: number;
}
export interface LedgerAccountLinkWrite {
  transactionHash: string;
  wallet: string;
  account: string;
  previousAccount: string;
  previousWallet: string;
}
export type LedgerLinkStatus =
  | { status: "linking" }
  | { status: "confirmed"; ledger: { address: string; chainId: string }; wallet: string | null; account: string };

export interface PaidGameLedger {
  address: string;
  chainId: string;
  shard: string;
  gameId: number;
}
export type GameEntry = { kind: "free" } | { kind: "paid"; ledger: PaidGameLedger };

export interface LedgerPayDecision {
  chainId: string;
  claimId: string;
  transactionHash: string;
  realmsId: string;
  wallet: string;
  seasonId: number;
  amount: string;
}
