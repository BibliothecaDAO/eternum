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

/** Resolve owner metadata from the authoritative owner address. */
export const resolveArmyOwnerState = ({ existingOwner, incomingOwner }: ResolveArmyOwnerStateInput): ArmyOwnerState => {
  const existingAddress = normalizeAddress(existingOwner?.address);
  const incomingAddress = normalizeAddress(incomingOwner.address);

  const existingName = cleanText(existingOwner?.ownerName);
  const existingGuild = cleanText(existingOwner?.guildName);
  const incomingName = cleanText(incomingOwner.ownerName);
  const incomingGuild = cleanText(incomingOwner.guildName);

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
