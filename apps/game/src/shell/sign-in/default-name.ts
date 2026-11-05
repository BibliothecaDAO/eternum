import { IDENTITY_PORTRAITS, NAME_MAX_LENGTH, nameRuleViolation, type Session } from "@realms-world/identity";

import { identityClient } from "@/hooks/context/identity-session";

/** A portrait from the identity set, picked at random for an account that has none. */
export const randomPortrait = (): string => IDENTITY_PORTRAITS[Math.floor(Math.random() * IDENTITY_PORTRAITS.length)];

/**
 * The names a new account tries in turn: its suggested name (the Discord name, which the identity service keeps only
 * when it passes the name rule), then that name with 2 to 5 after it. None without a suggestion: an email sign-up names
 * itself.
 */
export const defaultNameCandidates = (suggested: string | null | undefined): string[] => {
  if (!suggested) return [];
  const numbered = [2, 3, 4, 5].map((n) => `${suggested.slice(0, NAME_MAX_LENGTH - 1).trimEnd()}${n}`);
  return [suggested, ...numbered].filter((name) => nameRuleViolation(name) === null);
};

/**
 * Names a new account by itself, so sign-in goes straight on to the game (the name is changed later on You): the first
 * free candidate, with a random portrait. True once one is saved; false when there is no candidate, every one was taken
 * or the identity service refused, and the player names the account themselves.
 */
export const claimDefaultName = async (session: Session): Promise<boolean> => {
  const image = session.user.image ?? randomPortrait();
  for (const name of defaultNameCandidates(session.user.suggestedName)) {
    try {
      await identityClient.updateUser({ name, image });
      return true;
    } catch (cause) {
      if (!(cause instanceof Error) || cause.message !== "NAME_TAKEN") return false;
    }
  }
  return false;
};
