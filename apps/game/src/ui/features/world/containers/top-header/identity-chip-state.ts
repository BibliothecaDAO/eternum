import type { IdentitySessionStatus } from "@/hooks/context/identity-session";
import { StructureType } from "@bibliothecadao/types";

export interface IdentityStanding {
  rank: number;
  points: number;
}

export interface OwnedStructureCounts {
  structures: number;
  realms: number;
}

export type IdentityChipState =
  | { kind: "spectating"; name: string | null; canPlay: boolean }
  | { kind: "signed-out" }
  | { kind: "unnamed" }
  | { kind: "connecting"; name: string | null; error: string | null }
  | { kind: "player"; name: string; realmCount: number; standing: IdentityStanding | null };

export interface IdentityChipInput {
  /** `isExplicitSpectateSession()` from `utils/spectator-session` — the session-level spectator intent. */
  isExplicitSpectateSession: boolean;
  /** The session's chosen username: the only name a player has before their gameplay account is registered. */
  identity: { status: IdentitySessionStatus; name: string | null };
  gameplayAccount: { address: string | null; provisioningError: string | null };
  /** The in-game player name for the gameplay address (players slice), when the address has registered one. */
  playerName: string | null;
  owned: OwnedStructureCounts;
  standing: IdentityStanding | null;
}

export const NO_OWNED_STRUCTURES: OwnedStructureCounts = { structures: 0, realms: 0 };

// A brand-new player at rank #9000 with 0 points gains nothing from seeing it; the rank shows once they have
// either scored or climbed into the top 500.
const RANK_THRESHOLD = 500;

const isMeaningfullyRanked = (standing: IdentityStanding): boolean =>
  Number.isFinite(standing.rank) && (standing.rank <= RANK_THRESHOLD || standing.points > 0);

/**
 * One identity, one output. The session is the only "logged in" fact: a session without a chosen name is asked for
 * one, never named by its address; the gameplay account only decides between "connecting" and "player" once a named
 * session is there. An explicit spectate session wins over the gameplay account.
 */
export const resolveIdentityChipState = (input: IdentityChipInput): IdentityChipState => {
  const { identity } = input;
  if (identity.status === "signed-in") {
    return identity.name === null ? { kind: "unnamed" } : namedState(input, input.playerName ?? identity.name);
  }
  if (input.isExplicitSpectateSession) return { kind: "spectating", name: null, canPlay: false };
  if (identity.status === "loading") return { kind: "connecting", name: null, error: null };
  return { kind: "signed-out" };
};

/** A named session: spectating, its gameplay account still deploying, or playing under the in-game name. */
const namedState = (
  { isExplicitSpectateSession, gameplayAccount, owned, standing }: IdentityChipInput,
  name: string,
): IdentityChipState => {
  if (isExplicitSpectateSession) return { kind: "spectating", name, canPlay: owned.structures > 0 };
  if (!gameplayAccount.address) return { kind: "connecting", name, error: gameplayAccount.provisioningError };
  return {
    kind: "player",
    name,
    realmCount: owned.realms,
    standing: standing && isMeaningfullyRanked(standing) ? standing : null,
  };
};

interface OwnedStructureRow {
  owner: bigint;
  base: { category: number };
}

/** Ownership straight from the structures slice, so an explicit spectator's own realms count too. */
export const countOwnedStructures = (structures: readonly OwnedStructureRow[], owner: bigint): OwnedStructureCounts =>
  structures.reduce(
    (counts, structure) => {
      if (structure.owner !== owner) return counts;
      return {
        structures: counts.structures + 1,
        realms: counts.realms + (structure.base.category === StructureType.Realm ? 1 : 0),
      };
    },
    { ...NO_OWNED_STRUCTURES },
  );
