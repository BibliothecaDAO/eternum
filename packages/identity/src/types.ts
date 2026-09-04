export interface IdentityUser {
  id: string;
  address?: string | null;
  name: string;
  email: string;
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
