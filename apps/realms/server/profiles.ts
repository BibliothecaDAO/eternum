import { sql } from "drizzle-orm";

import { db } from "@realms-world/db/client";
import { user } from "@realms-world/db";
import { type IdentityProfile, normalizeStarknetAddress, profileOfIdentityUser } from "@realms-world/identity";

import { ownerOfGameplayAccount } from "./binding";

interface IdentityRow {
  id: string;
  name: string;
  image: string | null;
}

interface ProfileReaders {
  /** The owner behind a gameplay account, null when the address is not a bound gameplay account. */
  ownerOf(account: string): Promise<string | null>;
  identitiesOf(owners: string[]): Promise<IdentityRow[]>;
  now?(): number;
}

/** How long an unbound answer is trusted: an address can be bound later, so minutes, not the process life. */
export const UNBOUND_OWNER_TTL_MS = 5 * 60 * 1000;

interface OwnerAnswer {
  owner: string | null;
  /** Bound owners never change; an unbound answer expires. */
  expiresAt: number | null;
}

const ownerByAccount = new Map<string, OwnerAnswer>();

const rememberOwner = async (account: string, readers: ProfileReaders): Promise<string | null> => {
  const now = readers.now?.() ?? Date.now();
  const cached = ownerByAccount.get(account);
  if (cached && (cached.expiresAt === null || cached.expiresAt > now)) return cached.owner;
  const owner = await readers.ownerOf(account);
  const normalized = owner === null ? null : normalizeStarknetAddress(owner);
  ownerByAccount.set(account, {
    owner: normalized,
    expiresAt: normalized === null ? now + UNBOUND_OWNER_TTL_MS : null,
  });
  return normalized;
};

/**
 * Gameplay account addresses in, public profiles out, keyed by the address as sent. An address that is not a bound
 * gameplay account is read as an owner itself, so the realms app can ask by wallet too.
 */
export const profilesByAccounts = async (
  accounts: string[],
  readers: ProfileReaders = defaultReaders,
): Promise<Record<string, IdentityProfile>> => {
  if (accounts.length === 0) return {};
  const normalizedAccounts = accounts.map((account) => normalizeStarknetAddress(account));
  const owners = await Promise.all(
    normalizedAccounts.map(async (account) => (await rememberOwner(account, readers)) ?? account),
  );
  const identities = await readers.identitiesOf([...new Set(owners)]);
  const byOwner = new Map(identities.map((row) => [row.id, profileOfIdentityUser(row)]));
  return Object.fromEntries(
    accounts.flatMap((account, index) => {
      const profile = byOwner.get(owners[index] ?? account);
      return profile ? [[account, profile]] : [];
    }),
  );
};

const defaultReaders: ProfileReaders = {
  ownerOf: ownerOfGameplayAccount,
  identitiesOf: (owners) =>
    db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .where(sql`${user.id} in ${owners}`),
};
