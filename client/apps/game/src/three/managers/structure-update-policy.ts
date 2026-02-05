export type StructureVisibilityBucket = "mine" | "ally" | "enemy";

export interface StructureOwnershipState {
  isMine: boolean;
  isAlly: boolean;
}

export function getStructureVisibilityBucket(isMine: boolean, isAlly: boolean): StructureVisibilityBucket {
  if (isMine) {
    return "mine";
  }

  if (isAlly) {
    return "ally";
  }

  return "enemy";
}

export function shouldRefreshVisibleStructures(
  previous: StructureOwnershipState,
  next: StructureOwnershipState,
): boolean {
  return getStructureVisibilityBucket(previous.isMine, previous.isAlly) !== getStructureVisibilityBucket(next.isMine, next.isAlly);
}
