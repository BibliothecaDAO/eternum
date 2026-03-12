type StructureVisibilityBucket = "mine" | "ally" | "enemy";

interface StructureOwnershipState {
  isMine: boolean;
  isAlly: boolean;
}

interface StructureVisibleRefreshState extends StructureOwnershipState {
  hexCoords: { col: number; row: number };
  structureType: unknown;
  stage: number;
  level: number;
  cosmeticId?: string | null;
  attachmentSignature?: string;
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
  return (
    getStructureVisibilityBucket(previous.isMine, previous.isAlly) !==
    getStructureVisibilityBucket(next.isMine, next.isAlly)
  );
}

export function shouldRebuildVisibleStructuresForStructureUpdate(input: {
  previous?: StructureVisibleRefreshState;
  next: StructureVisibleRefreshState;
  wasVisible: boolean;
  isVisible: boolean;
}): boolean {
  if (!input.previous) {
    return input.isVisible;
  }

  if (input.wasVisible !== input.isVisible) {
    return input.wasVisible || input.isVisible;
  }

  if (!input.wasVisible && !input.isVisible) {
    return false;
  }

  if (
    input.previous.hexCoords.col !== input.next.hexCoords.col ||
    input.previous.hexCoords.row !== input.next.hexCoords.row ||
    input.previous.structureType !== input.next.structureType ||
    input.previous.stage !== input.next.stage ||
    input.previous.level !== input.next.level ||
    input.previous.cosmeticId !== input.next.cosmeticId ||
    input.previous.attachmentSignature !== input.next.attachmentSignature
  ) {
    return true;
  }

  return shouldRefreshVisibleStructures(input.previous, input.next);
}

export function resolveVisibleStructureUpdateMode(input: {
  previous?: StructureVisibleRefreshState;
  next: StructureVisibleRefreshState;
  wasVisible: boolean;
  isVisible: boolean;
}): "patch" | "rebuild" | "none" {
  if (!input.previous) {
    return input.isVisible ? "rebuild" : "none";
  }

  if (input.wasVisible !== input.isVisible) {
    return input.wasVisible || input.isVisible ? "rebuild" : "none";
  }

  if (!input.wasVisible && !input.isVisible) {
    return "none";
  }

  if (
    input.previous.structureType !== input.next.structureType ||
    input.previous.stage !== input.next.stage ||
    input.previous.level !== input.next.level ||
    input.previous.cosmeticId !== input.next.cosmeticId ||
    input.previous.attachmentSignature !== input.next.attachmentSignature
  ) {
    return "rebuild";
  }

  const ownershipBucketChanged = shouldRefreshVisibleStructures(input.previous, input.next);
  const positionChanged =
    input.previous.hexCoords.col !== input.next.hexCoords.col || input.previous.hexCoords.row !== input.next.hexCoords.row;
  if (!ownershipBucketChanged && !positionChanged) {
    return "none";
  }

  return "patch";
}
