import { IDENTITY_PORTRAITS, NAME_MAX_LENGTH, nameRuleViolation, type Session } from "@realms-world/identity";

import { identityClient } from "@/hooks/context/identity-session";
import { SIGN_IN_WORDS } from "@/ui/design-system/kit/words";

/** A portrait from the identity set, picked at random for an account that has none. */
export const randomPortrait = (): string => IDENTITY_PORTRAITS[Math.floor(Math.random() * IDENTITY_PORTRAITS.length)];

/**
 * The names a new account tries in turn, each passing the identity rule: its suggested name (the Discord name or the
 * email's local part) with what the rule refuses taken out, then that name with 2 to 5 after it. A suggestion too short
 * to keep stands in for the game's default name.
 */
export const defaultNameCandidates = (suggested: string | null | undefined): string[] => {
  const kept = (suggested ?? "").replace(/[^A-Za-z0-9 _-]/g, "").replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
  const base = nameRuleViolation(kept.slice(0, NAME_MAX_LENGTH)) === null ? kept : SIGN_IN_WORDS.defaultName;
  const numbered = [2, 3, 4, 5].map((n) => `${base.slice(0, NAME_MAX_LENGTH - 1).trimEnd()}${n}`);
  return [base.slice(0, NAME_MAX_LENGTH).trimEnd(), ...numbered].filter((name) => nameRuleViolation(name) === null);
};

/**
 * Names a new account by itself, so sign-in goes straight on to the game (the name is changed later on You): the first
 * free candidate, with a random portrait. True once one is saved; false when every candidate was taken or the identity
 * service refused, and the player names the account themselves.
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
