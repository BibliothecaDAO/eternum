import { assertProviderChain, valuePlaneAddress } from "@realms-world/chain";
import { RpcProvider } from "starknet";

const PRECISION = 10n ** 18n;
const CONCURRENT_READS = 100;
const FIELD_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;

/** A response names immutable chain state, rather than several reads of a height that might be reorganized. */
export async function openRatingLedger(provider: RpcProvider, blockHash?: string) {
  const signal = AbortSignal.timeout(10_000);
  const [, block] = await Promise.all([
    assertProviderChain(provider, "mainnet", "identity ratings"),
    provider.getBlock(blockHash ?? "latest"),
  ]);
  const number = "block_number" in block ? block.block_number : undefined;
  const canonicalHash = "block_hash" in block ? block.block_hash : undefined;
  if (
    typeof number !== "number" ||
    !Number.isSafeInteger(number) ||
    number < 0 ||
    typeof canonicalHash !== "string" ||
    !/^0x[0-9a-fA-F]{1,64}$/.test(canonicalHash) ||
    BigInt(canonicalHash) <= 0n ||
    BigInt(canonicalHash) >= FIELD_PRIME
  )
    throw new Error("Invalid confirmed rating block");
  if (blockHash && BigInt(canonicalHash) !== BigInt(blockHash)) throw new Error("Wrong rating block");
  return { provider, signal, block: number, blockHash: `0x${BigInt(canonicalHash).toString(16)}` };
}

export type RatingLedger = Pick<
  Awaited<ReturnType<typeof openRatingLedger>>,
  "provider" | "signal" | "block" | "blockHash"
>;

/** Both API reads use the token's effective rating, including its initial rating, with the same u256 decoder. */
export async function readLedgerRatings(ledger: RatingLedger, owners: string[]): Promise<Map<string, bigint>> {
  const ratings = new Map<string, bigint>();
  for (let offset = 0; offset < owners.length; offset += CONCURRENT_READS) {
    ledger.signal.throwIfAborted();
    await Promise.all(
      owners.slice(offset, offset + CONCURRENT_READS).map(async (player) => {
        const result = await ledger.provider.callContract(
          { contractAddress: valuePlaneAddress("mmrToken"), entrypoint: "get_player_mmr", calldata: [player] },
          ledger.blockHash,
        );
        ratings.set(player, decodeRating(result));
      }),
    );
  }
  ledger.signal.throwIfAborted();
  return ratings;
}

function decodeRating(result: string[]) {
  if (result.length !== 2 || !result.every((limb) => /^0x[0-9a-fA-F]{1,32}$/.test(limb)))
    throw new Error("Invalid MMR u256");
  const raw = BigInt(result[0]!) + (BigInt(result[1]!) << 128n);
  if (raw === 0n) throw new Error("Effective MMR must be nonzero");
  return raw;
}

export function ratingPoints(raw: bigint) {
  const fraction = (raw % PRECISION).toString().padStart(18, "0").replace(/0+$/, "");
  return `${raw / PRECISION}${fraction ? `.${fraction}` : ""}`;
}
