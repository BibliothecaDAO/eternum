import { ClientComponents, ContractAddress } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { gameEntityKey } from "@/sync/game-scope";

// Addresses reach this comparison in every felt spelling the stack produces — padded from the gameplay account
// (`addAddressPadding`), unpadded from herald rows, bigint from RECS — so equality is numeric, never textual.
const toAddress = (value: unknown): bigint | null => {
  if (typeof value !== "string" && typeof value !== "bigint" && typeof value !== "number") return null;
  try {
    return ContractAddress(typeof value === "number" ? BigInt(value) : value);
  } catch {
    return null;
  }
};

export const isEntityOwnedByAccount = (
  components: ClientComponents | null | undefined,
  entityId: number,
  accountAddress: string | undefined,
): boolean => {
  if (!components || !entityId || !accountAddress) return false;
  try {
    const structure = getComponentValue(components.Structure, gameEntityKey([BigInt(entityId)]));
    const owner = toAddress(structure?.owner);
    const accountOwner = toAddress(accountAddress);
    return owner !== null && accountOwner !== null && owner === accountOwner;
  } catch {
    return false;
  }
};

export function arePlayersAllied(
  components: ClientComponents | null | undefined,
  playerAddress: bigint | string | undefined,
  ownerAddress: bigint | string | undefined,
): boolean {
  const player = toAddress(playerAddress);
  const owner = toAddress(ownerAddress);
  if (!components?.GuildMember || !player || !owner || player === owner) return false;
  const playerGuild = getComponentValue(components.GuildMember, gameEntityKey([player]))?.guild_id;
  if (!playerGuild) return false;
  return getComponentValue(components.GuildMember, gameEntityKey([owner]))?.guild_id === playerGuild;
}
