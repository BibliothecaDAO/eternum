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
  | { kind: "connecting"; name: string | null; error: string | null }
  | { kind: "player"; name: string; realmCount: number; standing: IdentityStanding | null };

export interface IdentityChipInput {
  /** `isExplicitSpectateSession()` from `utils/spectator-session` — the session-level spectator intent. */
  isExplicitSpectateSession: boolean;
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

export const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;

const resolveDisplayName = ({ identity, gameplayAccount, playerName }: IdentityChipInput): string | null =>
  playerName ?? identity.name ?? (gameplayAccount.address ? shortAddress(gameplayAccount.address) : null);

/**
 * One identity, one output. The session is the only "logged in" fact; the gameplay account only decides between
 * "connecting" and "player" once the session is there. An explicit spectate session wins over everything else.
 */
export const resolveIdentityChipState = (input: IdentityChipInput): IdentityChipState => {
  const { identity, gameplayAccount, owned, standing } = input;
  const isSignedIn = identity.status === "signed-in";

  if (input.isExplicitSpectateSession) {
    return {
      kind: "spectating",
      name: isSignedIn ? resolveDisplayName(input) : null,
      canPlay: isSignedIn && owned.structures > 0,
    };
  }
  if (identity.status === "loading") return { kind: "connecting", name: null, error: null };
  if (!isSignedIn) return { kind: "signed-out" };
  if (!gameplayAccount.address) {
    return { kind: "connecting", name: resolveDisplayName(input), error: gameplayAccount.provisioningError };
  }
  return {
    kind: "player",
    name: resolveDisplayName(input) ?? shortAddress(gameplayAccount.address),
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
