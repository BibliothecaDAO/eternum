export interface IdentityUser {
  id: string;
  address?: string | null;
  name: string;
  email: string;
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
