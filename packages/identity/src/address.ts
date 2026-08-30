/**
 * The one Starknet address normalization for identity keys: lowercase 0x hex
 * with no leading zeros. Wallets, the identity database, the MMR indexer and
 * every join between them use this form — nobody re-derives it locally.
 */
export const normalizeStarknetAddress = (address: string | bigint): string => `0x${BigInt(address).toString(16)}`;

export const isSameStarknetAddress = (left: string | bigint, right: string | bigint): boolean =>
  BigInt(left) === BigInt(right);
