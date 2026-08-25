import { ClientComponents } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { gameEntityKey } from "@/dojo/game-scope";

const normalizeOwnerValue = (owner: unknown): string | null => {
  if (typeof owner === "string") return owner.trim().toLowerCase();
  if (typeof owner === "bigint") return `0x${owner.toString(16)}`;
  if (typeof owner === "number" && Number.isFinite(owner)) return `0x${BigInt(owner).toString(16)}`;
  return null;
};

export const isEntityOwnedByAccount = (
  components: ClientComponents | null | undefined,
  entityId: number,
  accountAddress: string | undefined,
): boolean => {
  if (!components || !entityId || !accountAddress) return false;
  try {
    const structure = getComponentValue(components.Structure, gameEntityKey([BigInt(entityId)]));
    const owner = normalizeOwnerValue(structure?.owner);
    const accountOwner = normalizeOwnerValue(accountAddress);
    return Boolean(owner && accountOwner && owner === accountOwner);
  } catch {
    return false;
  }
};
