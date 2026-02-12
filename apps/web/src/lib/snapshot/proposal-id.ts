function toSafeInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function normalizeProposalId(
  proposalId: string | number | null | undefined,
): number | null {
  if (typeof proposalId === "number") {
    return Number.isSafeInteger(proposalId) ? proposalId : null;
  }

  if (typeof proposalId !== "string") {
    return null;
  }

  const trimmed = proposalId.trim();
  if (!trimmed) {
    return null;
  }

  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  const lastSegment = withoutHash.split("/").at(-1);
  if (!lastSegment) {
    return null;
  }

  return toSafeInteger(lastSegment);
}

export function isMatchingProposalVote(
  voteProposalId: string | number | null | undefined,
  proposalId: string | number | null | undefined,
): boolean {
  const normalizedVoteId = normalizeProposalId(voteProposalId);
  const normalizedProposalId = normalizeProposalId(proposalId);

  return (
    normalizedVoteId !== null &&
    normalizedProposalId !== null &&
    normalizedVoteId === normalizedProposalId
  );
}

export function formatSnapshotProposalReference(
  spaceId: string,
  proposalId: string | number | null | undefined,
): string | null {
  if (!spaceId) {
    return null;
  }

  const normalizedProposalId = normalizeProposalId(proposalId);
  if (normalizedProposalId === null) {
    return null;
  }

  return `${spaceId}/${normalizedProposalId}`;
}
