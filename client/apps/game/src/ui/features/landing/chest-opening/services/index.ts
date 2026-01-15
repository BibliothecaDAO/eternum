import { CollectibleClaimed, RealmMetadata, TokenBalanceWithToken } from "../utils/types";
import { fetchSQL } from "./api-client";
import { QUERIES } from "./queries";

// Collection configuration for loot chests
// These values should match the network (mainnet/sepolia)
const LOOT_CHEST_COLLECTION_ID = 3; // mainnet

/**
 * Pad address to 66 characters (0x + 64 hex chars)
 */
function padAddress(address: string): string {
  if (!address) return "";
  const cleanAddress = address.startsWith("0x") ? address.slice(2) : address;
  return "0x" + cleanAddress.padStart(64, "0");
}

/**
 * Normalize metadata to ensure consistent structure
 */
function normalizeMetadata(rawMetadata: string | RealmMetadata | null | undefined): RealmMetadata | null {
  if (!rawMetadata) return null;

  try {
    const metadataObj = typeof rawMetadata === "string" ? JSON.parse(rawMetadata) : rawMetadata;
    if (metadataObj && Array.isArray(metadataObj.attributes)) {
      metadataObj.attributes = metadataObj.attributes.map((attribute: Record<string, unknown>) => {
        if (attribute && attribute.trait && !attribute.trait_type) {
          return { ...attribute, trait_type: attribute.trait };
        }
        return attribute;
      });
    }
    return metadataObj;
  } catch {
    return null;
  }
}

interface RawTokenBalanceWithMetadata {
  token_id: string;
  balance: string;
  contract_address: string;
  token_owner: string;
  name?: string;
  symbol?: string;
  expiration?: number;
  best_price_hex?: string;
  metadata?: string | RealmMetadata;
  order_id?: string;
}

/**
 * Fetch token balances with metadata for a specific address and contract.
 * Used for cosmetics and other tokens that don't need marketplace data.
 */
export async function fetchTokenBalancesWithMetadata(
  contractAddress: string,
  accountAddress: string,
): Promise<TokenBalanceWithToken[]> {
  const query = QUERIES.TOKEN_BALANCES_WITH_METADATA.replaceAll("{contractAddress}", padAddress(contractAddress))
    .replaceAll("{accountAddress}", padAddress(accountAddress));

  const rawData = await fetchSQL<RawTokenBalanceWithMetadata[]>(query);

  return rawData.map((item) => ({
    token_id: Number(item.token_id.split(":")[1]).toString(),
    balance: item.balance,
    contract_address: item.contract_address,
    account_address: item.token_owner,
    name: item.name ?? null,
    symbol: item.symbol ?? null,
    expiration: null,
    best_price_hex: null,
    metadata: normalizeMetadata(item.metadata),
    order_id: null,
  }));
}

/**
 * Fetch loot chest balances with marketplace order data.
 * Includes active listing information for each chest.
 */
export async function fetchLootChestBalances(
  contractAddress: string,
  accountAddress: string,
): Promise<TokenBalanceWithToken[]> {
  const collectionId = LOOT_CHEST_COLLECTION_ID;

  const query = QUERIES.TOKEN_BALANCES_WITH_MARKETPLACE.replaceAll("{contractAddress}", padAddress(contractAddress))
    .replace("{collectionId}", collectionId.toString())
    .replaceAll("{accountAddress}", padAddress(accountAddress))
    .replace("{trimmedAccountAddress}", padAddress(accountAddress));

  const rawData = await fetchSQL<RawTokenBalanceWithMetadata[]>(query);

  return rawData.map((item) => ({
    token_id: Number(item.token_id.split(":")[1]).toString(),
    balance: item.balance,
    contract_address: item.contract_address,
    account_address: item.token_owner,
    name: item.name ?? null,
    symbol: item.symbol ?? null,
    expiration: item.expiration ?? null,
    best_price_hex: item.best_price_hex ? BigInt(item.best_price_hex) : null,
    metadata: normalizeMetadata(item.metadata),
    order_id: item.order_id ?? null,
  }));
}

/**
 * Fetch collectible claimed events for a specific player
 */
export async function fetchCollectibleClaimed(
  contractAddress: string,
  playerAddress: string,
  minTimestamp: number = 0,
): Promise<CollectibleClaimed[]> {
  // Convert Unix timestamp to ISO string format for SQL datetime comparison
  const formattedTimestamp = new Date(minTimestamp * 1000).toISOString().replace("T", " ").replace("Z", "");

  const query = QUERIES.COLLECTIBLE_CLAIMED.replace("{contractAddress}", padAddress(contractAddress))
    .replace("{playerAddress}", padAddress(playerAddress))
    .replace("{minTimestamp}", `'${formattedTimestamp}'`);

  return await fetchSQL<CollectibleClaimed[]>(query);
}
