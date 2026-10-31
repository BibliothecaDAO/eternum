import { normalizeStarknetAddress } from "@realms-world/identity";

/** A player's place and points as the native store holds them, the same standings the players panel ranks by. */
interface Standing {
  address: string;
  rank: number;
  totalPoints: number;
}

/**
 * The top ten by rank, then, when they rank lower, the viewer's own row (as Results keeps it) and the selected
 * structure's owner. Only the viewer's row is marked `own`, as on Results: a tie is never lit as someone's first place.
 */
export function selectSpectatorStandings(
  entries: readonly Standing[],
  { viewer, selected }: { viewer: string | null | undefined; selected: bigint | undefined },
) {
  const ownKey = viewer ? normalizeStarknetAddress(viewer) : null;
  const selectedKey = selected ? normalizeStarknetAddress(selected) : null;
  const ranked = entries
    .map((entry) => ({ ...entry, address: normalizeStarknetAddress(entry.address) }))
    .toSorted((left, right) => left.rank - right.rank);
  const kept = new Set(ranked.slice(0, 10).map((entry) => entry.address));
  if (ownKey) kept.add(ownKey);
  if (selectedKey) kept.add(selectedKey);
  return ranked
    .filter((entry) => kept.has(entry.address))
    .map((entry) => ({ ...entry, own: entry.address === ownKey }));
}
