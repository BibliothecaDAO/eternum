interface ArmyOwnerState {
  address: bigint;
  ownerName: string;
  guildName: string;
}

interface OptionalArmyOwnerState {
  address?: bigint | null;
  ownerName?: string;
  guildName?: string;
}

interface ResolveArmyOwnerStateInput {
  existingOwner?: OptionalArmyOwnerState | null;
  incomingOwner: OptionalArmyOwnerState;
}

const cleanText = (value?: string): string => {
  if (!value) {
    return "";
  }

  return value
    .toString()
    .split("")
    .filter((char) => char.charCodeAt(0) !== 0)
    .join("")
    .trim();
};

const normalizeAddress = (address?: bigint | null): bigint => {
  if (address === undefined || address === null) {
    return 0n;
  }
  return address;
};

/**
 * Resolve an owner update while guarding against transient stale updates where
 * owner address briefly resolves to 0n before cache/ECS catches up.
 */
export const resolveArmyOwnerState = ({ existingOwner, incomingOwner }: ResolveArmyOwnerStateInput): ArmyOwnerState => {
  const existingAddress = normalizeAddress(existingOwner?.address);
  const incomingAddress = normalizeAddress(incomingOwner.address);

  const existingName = cleanText(existingOwner?.ownerName);
  const existingGuild = cleanText(existingOwner?.guildName);
  const incomingName = cleanText(incomingOwner.ownerName);
  const incomingGuild = cleanText(incomingOwner.guildName);

  // Keep the known player owner when a transient stale update reports 0n.
  if (incomingAddress === 0n && existingAddress !== 0n) {
    return {
      address: existingAddress,
      ownerName: existingName,
      guildName: existingGuild,
    };
  }

  const shouldReuseExistingName =
    incomingName.length === 0 && existingAddress === incomingAddress && existingAddress !== 0n;
  const shouldReuseExistingGuild =
    incomingGuild.length === 0 && existingAddress === incomingAddress && existingAddress !== 0n;

  return {
    address: incomingAddress,
    ownerName: shouldReuseExistingName ? existingName : incomingName,
    guildName: shouldReuseExistingGuild ? existingGuild : incomingGuild,
  };
};
