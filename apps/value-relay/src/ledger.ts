import { rpcAt } from "./rpc";
import { Account, hash, RpcProvider, type EmittedEvent } from "starknet";
import { blitzCommitment } from "./blitz-commitment";
import {
  relayOperation,
  type BlitzCommitment,
  type BlitzResult,
  type Page,
  type PaidClaim,
  type RelayPorts,
} from "./ports";

interface LedgerCredentials {
  rpcUrl: string;
  contractAddress: string;
  accountAddress: string;
  privateKey: string;
}
interface LedgerGameKey {
  chainId: string;
  gameId: number;
}
interface LedgerGame {
  start: number;
  end: number;
  registeredCount: number;
  cancelled: boolean;
  finalized: boolean;
  commitment: string;
}

/** Published Game field order, read at one confirmed head for all roster entries. */
async function readLedgerGame(
  provider: RpcProvider,
  address: string,
  key: LedgerGameKey,
  head: number,
): Promise<LedgerGame> {
  const fields = await provider.callContract(
    { contractAddress: address, entrypoint: "get_game", calldata: [key.chainId, String(key.gameId)] },
    head,
  );
  if (fields.length !== 13 || BigInt(fields[1]!) !== 1n) throw new Error("invalid_ledger_game");
  return {
    start: safeInteger(fields[3]!),
    end: safeInteger(fields[4]!),
    registeredCount: safeInteger(fields[10]!),
    commitment: fields[9]!,
    cancelled: bool(fields[11]!),
    finalized: bool(fields[12]!),
  };
}

/** Replay-safe result delivery: an already finalized matching result is complete, a different one is refused. */
export const ledgerResultAdapter =
  (credentials: LedgerCredentials): RelayPorts["ledger"]["postResult"] =>
  (result) =>
    relayOperation("post Blitz result", async () => {
      const provider = rpcAt(credentials.rpcUrl);
      const head = await provider.getBlockNumber();
      const game = await readLedgerGame(provider, credentials.contractAddress, result, head);
      if (game.finalized) {
        if (BigInt(game.commitment) !== BigInt(result.commitment)) throw new Error("ledger_result_differs");
        return;
      }
      if (BigInt(blitzCommitment(result)) !== BigInt(result.commitment)) throw new Error("invalid_result_commitment");
      const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
      const transaction = await account.execute({
        contractAddress: credentials.contractAddress,
        entrypoint: "apply_results",
        calldata: resultCalldata(result),
      });
      const receipt = await provider.waitForTransaction(transaction.transaction_hash);
      if (receipt.isReverted()) throw new Error("ledger_result_reverted");
    });

const resultCalldata = (result: BlitzResult): string[] => {
  const calldata = [result.chainId, String(result.gameId), String(result.rows.length)];
  for (const row of result.rows) {
    const amount = BigInt(row.chest.lords);
    calldata.push(
      row.wallet,
      row.points,
      String(row.rank),
      String(row.chest.kind),
      row.chest.cosmetic,
      String(amount & (2n ** 128n - 1n)),
      String(amount >> 128n),
    );
  }
  return calldata;
};

/** Confirmed ledger events are the monitor's enumeration; each cursor pins the head across all pages. */
export const ledgerMonitorReads = (
  rpcUrl: string,
  address: string,
): Pick<RelayPorts["ledger"], "paidClaims" | "postedResults"> => {
  const provider = rpcAt(rpcUrl);
  return {
    paidClaims: (cursor) =>
      relayOperation("read ledger paid claims", () =>
        ledgerEventPage(provider, address, "WithdrawalPaid", cursor, decodePayment),
      ),
    postedResults: (cursor) =>
      relayOperation("read ledger posted results", () =>
        ledgerEventPage(provider, address, "ResultsApplied", cursor, decodeResult),
      ),
  };
};

const ledgerEventPage = async <A>(
  provider: RpcProvider,
  address: string,
  name: string,
  after: string | null,
  decode: (event: EmittedEvent) => A,
): Promise<Page<A>> => {
  const selector = hash.getSelectorFromName(name);
  const cursor = after === null ? { head: await provider.getBlockNumber(), token: undefined } : readCursor(after);
  const page = await provider.getEvents({
    address,
    from_block: { block_number: 0 },
    to_block: { block_number: cursor.head },
    keys: [[selector]],
    chunk_size: 100,
    ...(cursor.token ? { continuation_token: cursor.token } : {}),
  });
  const rows = page.events.map((event) => {
    if (BigInt(event.from_address) !== BigInt(address) || BigInt(event.keys[0] ?? "0") !== BigInt(selector))
      throw new Error("invalid_ledger_event");
    return decode(event);
  });
  return {
    rows,
    next: page.continuation_token ? JSON.stringify({ head: cursor.head, token: page.continuation_token }) : null,
  };
};
const readCursor = (value: string): { head: number; token: string } => {
  const cursor = JSON.parse(value) as { head?: unknown; token?: unknown };
  if (
    !Number.isSafeInteger(cursor.head) ||
    Number(cursor.head) < 0 ||
    typeof cursor.token !== "string" ||
    !cursor.token
  )
    throw new Error("invalid_ledger_cursor");
  return { head: Number(cursor.head), token: cursor.token };
};
const decodePayment = (event: EmittedEvent): PaidClaim => {
  if (event.keys.length !== 3 || event.data.length !== 4) throw new Error("invalid_payment_event");
  return {
    chainId: event.keys[1]!,
    transactionHash: event.keys[2]!,
    seasonId: safeInteger(event.data[0]!),
    wallet: event.data[1]!,
    amount: u256(event.data[2]!, event.data[3]!),
  };
};
const decodeResult = (event: EmittedEvent): BlitzCommitment => {
  if (event.keys.length !== 3 || event.data.length !== 4) throw new Error("invalid_result_event");
  return { chainId: event.keys[1]!, gameId: safeInteger(event.keys[2]!), commitment: event.data[1]! };
};
const u256 = (low: string, high: string): string => {
  const limbs = [BigInt(low), BigInt(high)];
  if (limbs.some((limb) => limb < 0n || limb >= 2n ** 128n)) throw new Error("invalid_u256_limb");
  return String(limbs[0]! + (limbs[1]! << 128n));
};
const safeInteger = (value: string): number => {
  const n = Number(BigInt(value));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("invalid_ledger_integer");
  return n;
};
const bool = (value: string): boolean => {
  if (BigInt(value) !== 0n && BigInt(value) !== 1n) throw new Error("invalid_ledger_bool");
  return BigInt(value) === 1n;
};
