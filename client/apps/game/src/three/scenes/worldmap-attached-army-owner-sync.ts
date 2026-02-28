interface ResolveAttachedArmyOwnerInput {
  existingArmyOwner?: bigint;
  incomingStructureOwner: bigint;
}

export function resolveAttachedArmyOwnerFromStructure(input: ResolveAttachedArmyOwnerInput): bigint {
  if (
    input.incomingStructureOwner === 0n &&
    input.existingArmyOwner !== undefined &&
    input.existingArmyOwner !== 0n
  ) {
    return input.existingArmyOwner;
  }

  return input.incomingStructureOwner;
}
