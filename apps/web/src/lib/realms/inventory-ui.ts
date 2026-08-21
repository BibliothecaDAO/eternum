import type { RealmOwnershipInventoryStatus } from "@realms-world/db";

export type RealmInventoryViewState =
  | RealmOwnershipInventoryStatus
  | "loading"
  | "error";

export function getRealmInventoryViewState(input: {
  isPending: boolean;
  isError: boolean;
  status?: RealmOwnershipInventoryStatus;
}): RealmInventoryViewState {
  if (input.isPending) return "loading";
  if (input.isError || !input.status) return "error";
  return input.status;
}

export function parseRealmTokenId(value: unknown) {
  const tokenId =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;

  return Number.isSafeInteger(tokenId) && tokenId >= 0 ? tokenId : undefined;
}

export function getRealmRowId(realm: { token_id: number }) {
  const tokenId = parseRealmTokenId(realm.token_id);
  if (tokenId === undefined) {
    throw new Error("Realm table rows require a token ID");
  }

  return tokenId.toString();
}

export function retainExistingRealmSelections(
  selection: Record<string, boolean>,
  realms: { token_id: number }[],
) {
  const existingRealmIds = new Set(realms.map(getRealmRowId));
  const retained = Object.fromEntries(
    Object.entries(selection).filter(
      ([realmId, isSelected]) => isSelected && existingRealmIds.has(realmId),
    ),
  );

  return Object.keys(retained).length === Object.keys(selection).length
    ? selection
    : retained;
}
