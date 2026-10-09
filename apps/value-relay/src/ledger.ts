import { rpcAt, readLedgerGame, ledgerInteger } from "@realms-world/value-ledger";
import { Account, hash, RpcProvider, type EmittedEvent } from "starknet";
import { blitzCommitment } from "@realms-world/value-ledger/commitment";
import {
  relayOperation,
  type BlitzCommitment,
  type ChestChange,
  type ChestPage,
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
/** Replay-safe result delivery: an already finalized matching result is complete, a different one is refused. */
export const ledgerResultAdapter =
  (credentials: LedgerCredentials): RelayPorts["ledger"]["postResult"] =>
  (result) =>
    relayOperation("post Blitz result", async () => {
      if (BigInt(blitzCommitment(result)) !== BigInt(result.commitment)) throw new Error("invalid_result_commitment");
      const provider = rpcAt(credentials.rpcUrl);
      const head = await provider.getBlockNumber();
      const game = await readLedgerGame(provider, credentials.contractAddress, result, head);
      if (game.finalized) {
        if (BigInt(game.commitment) !== BigInt(result.commitment)) throw new Error("ledger_result_differs");
        return;
      }
      const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
      const transaction = await account.execute({
        contractAddress: credentials.contractAddress,
        entrypoint: "apply_results",
        calldata: resultCalldata(result),
      });
      const receipt = await provider.waitForTransaction(transaction.transaction_hash);
      if (receipt.isReverted()) throw new Error("ledger_result_reverted");
      const posted = await readLedgerGame(
        provider,
        credentials.contractAddress,
        result,
        await provider.getBlockNumber(),
      );
      if (!posted.finalized || BigInt(posted.commitment) !== BigInt(result.commitment))
        throw new Error("ledger_result_not_recorded");
    });

const resultCalldata = (result: BlitzResult): string[] => {
  const calldata = [result.chainId, String(result.gameId), String(result.rows.length)];
  for (const row of result.rows) calldata.push(row.wallet, String(row.rank));
  return calldata;
};

/** Confirmed ledger events are the monitor's enumeration; each cursor pins the head across all pages. */
export const ledgerMonitorReads = (
  rpcUrl: string,
  address: string,
): Pick<RelayPorts["ledger"], "paidClaims" | "postedResults"> => {
  return {
    paidClaims: (cursor, fromBlock = 0) =>
      relayOperation("read ledger paid claims", () =>
        ledgerEventPage(rpcAt(rpcUrl), address, ["WithdrawalPaid"], cursor, fromBlock, decodePayment),
      ),
    postedResults: (cursor, fromBlock = 0) =>
      relayOperation("read ledger posted results", () =>
        ledgerEventPage(rpcAt(rpcUrl), address, ["ResultsApplied"], cursor, fromBlock, decodeResult),
      ),
  };
};

const ledgerEventPage = async <A>(
  provider: RpcProvider,
  address: string,
  names: readonly string[],
  after: string | null,
  fromBlock: number,
  decode: (event: EmittedEvent) => A,
): Promise<Page<A> & { head: number }> => {
  const selectors = names.map((name) => hash.getSelectorFromName(name));
  const cursor = after === null ? { head: await provider.getBlockNumber(), token: undefined } : readCursor(after);
  if (fromBlock > cursor.head) return { rows: [], head: cursor.head, next: null };
  const page = await provider.getEvents({
    address,
    from_block: { block_number: fromBlock },
    to_block: { block_number: cursor.head },
    keys: [selectors],
    chunk_size: 100,
    ...(cursor.token ? { continuation_token: cursor.token } : {}),
  });
  const rows = page.events.map((event) => {
    if (
      BigInt(event.from_address) !== BigInt(address) ||
      !selectors.some((selector) => BigInt(event.keys[0] ?? "0") === BigInt(selector))
    )
      throw new Error("invalid_ledger_event");
    return decode(event);
  });
  return {
    rows,
    head: cursor.head,
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
    seasonId: ledgerInteger(event.data[0]!),
    wallet: event.data[1]!,
    amount: u256(event.data[2]!, event.data[3]!),
  };
};
const decodeResult = (event: EmittedEvent): BlitzCommitment => {
  if (event.keys.length !== 3 || event.data.length !== 4) throw new Error("invalid_result_event");
  return { chainId: event.keys[1]!, gameId: ledgerInteger(event.keys[2]!), commitment: event.data[1]! };
};
const u256 = (low: string, high: string): string => {
  const limbs = [BigInt(low), BigInt(high)];
  if (limbs.some((limb) => limb < 0n || limb >= 2n ** 128n)) throw new Error("invalid_u256_limb");
  return String(limbs[0]! + (limbs[1]! << 128n));
};
/** Requested and opened events share one ordered cursor, so historical completed chests leave no polling debt. */
export const ledgerChestChanges = (rpcUrl: string, address: string, fromBlock: number, cursor: string | null) =>
  relayOperation(
    "read chest requests",
    (): Promise<ChestPage> =>
      ledgerEventPage(rpcAt(rpcUrl), address, ["ChestRequested", "ChestOpened"], cursor, fromBlock, decodeChestChange),
  );

const decodeChestChange = (event: EmittedEvent): ChestChange => {
  if (event.keys.length !== 4) throw new Error("invalid_chest_event");
  const tokenId = u256(event.keys[1]!, event.keys[2]!);
  if (BigInt(event.keys[0]!) === BigInt(hash.getSelectorFromName("ChestOpened"))) {
    if (event.data.length !== 4) throw new Error("invalid_chest_opened_event");
    return { kind: "finished", tokenId };
  }
  if (event.data.length !== 1) throw new Error("invalid_chest_requested_event");
  return {
    kind: "requested",
    request: { tokenId, requester: event.keys[3]!, requestBlock: ledgerInteger(event.data[0]!) },
  };
};
