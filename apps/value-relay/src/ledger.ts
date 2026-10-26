import { Effect } from "effect";
import {
  decodeFrontierSeason,
  isDeploymentBlock,
  rpcAt,
  ledgerInteger,
  ledgerU256,
  readConfirmedLedgerHead,
} from "@realms-world/value-ledger";
import { Account, hash, RpcProvider, type EmittedEvent } from "starknet";
import { blitzCommitment } from "@realms-world/value-ledger/commitment";
import {
  relayOperation,
  type BlitzCommitment,
  type ChestChange,
  type ChestPage,
  type BlitzResult,
  type LedgerPage,
  type LedgerAnchor,
  type PaidClaim,
  type RelayPorts,
  type MonitorPorts,
} from "./ports";

/** The ledger as its history readers need it: its address and the block it was deployed in. */
export interface LedgerContract {
  contractAddress: string;
  deploymentBlock: number;
}
interface LedgerCredentials {
  rpcUrl: string;
  contractAddress: string;
  accountAddress: string;
  privateKey: string;
}
/**
 * The block a scan of the ledger's history runs from: a saved block as it is, else the ledger's deployment block, which
 * no event of it predates. The address book names that block; one where the ledger does not first exist is refused,
 * since starting after it would skip events.
 */
export const ledgerHistoryFrom = async (provider: RpcProvider, ledger: LedgerContract, saved?: number) => {
  if (saved !== undefined) return saved;
  if (!(await isDeploymentBlock(provider, ledger.contractAddress, ledger.deploymentBlock)))
    throw new Error("ledger_deployment_block_wrong");
  return ledger.deploymentBlock;
};
/** Replay-safe result delivery: an already finalized matching result is complete, a different one is refused. */
export const ledgerResultAdapter =
  (credentials: LedgerCredentials, slotId: number): RelayPorts["ledger"]["postResult"] =>
  (result) =>
    relayOperation("post Blitz result", async () => {
      if (BigInt(blitzCommitment(result)) !== BigInt(result.commitment)) throw new Error("invalid_result_commitment");
      const provider = rpcAt(credentials.rpcUrl);
      const head = (await readConfirmedLedgerHead(provider)).number;
      const existing = await resultCommitment(provider, credentials.contractAddress, result, head);
      if (BigInt(existing) !== 0n) {
        if (BigInt(existing) !== BigInt(result.commitment)) throw new Error("ledger_result_differs");
        return;
      }
      const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
      const transaction = await account.execute({
        contractAddress: credentials.contractAddress,
        entrypoint: "apply_results",
        calldata: resultCalldata(result, slotId),
      });
      const receipt = await provider.waitForTransaction(transaction.transaction_hash);
      if (receipt.isReverted()) throw new Error("ledger_result_reverted");
      const posted = await resultCommitment(
        provider,
        credentials.contractAddress,
        result,
        (await readConfirmedLedgerHead(provider)).number,
      );
      if (BigInt(posted) !== BigInt(result.commitment)) throw new Error("ledger_result_not_recorded");
    });

/**
 * A result is posted for the slot that paid for its game, once that slot's roster is verified. A game the launch
 * directory declares outside any slot took no entry, so its result has nothing to post and is complete as it stands.
 */
export const postVerifiedResult = async (
  result: BlitzResult,
  verifyRoster: (chainId: string, gameId: number) => Promise<number | null>,
  postFor: (slotId: number) => RelayPorts["ledger"]["postResult"],
): Promise<void> => {
  const slotId = await verifyRoster(result.chainId, result.gameId);
  if (slotId !== null) await Effect.runPromise(postFor(slotId)(result));
};

const resultCalldata = (result: BlitzResult, slotId: number): string[] => {
  const calldata = [result.chainId, String(slotId), String(result.gameId), String(result.rows.length)];
  for (const row of result.rows) calldata.push(row.wallet, String(row.rank));
  return calldata;
};

const resultCommitment = async (provider: RpcProvider, address: string, result: BlitzCommitment, head: number) => {
  const fields = await provider.callContract(
    {
      contractAddress: address,
      entrypoint: "get_result_commitment",
      calldata: [result.chainId, String(result.gameId)],
    },
    head,
  );
  if (fields.length !== 1) throw new Error("invalid_result_commitment");
  return fields[0]!;
};

/** Confirmed ledger events are the monitor's enumeration; each cursor pins the head across all pages. */
export const ledgerMonitorReads = (
  rpcUrl: string,
  ledger: LedgerContract,
): Pick<MonitorPorts["ledger"], "paidClaims" | "postedResults" | "frontierPool"> => {
  const address = ledger.contractAddress;
  return {
    frontierPool: (chainId, gameId) =>
      relayOperation("read ledger Frontier pool", async () => {
        const provider = rpcAt(rpcUrl);
        const head = await readConfirmedLedgerHead(provider);
        return decodeFrontierSeason(
          await provider.callContract(
            {
              contractAddress: address,
              entrypoint: "get_frontier",
              calldata: [chainId, String(gameId)],
            },
            head.number,
          ),
        ).pool;
      }),
    paidClaims: (cursor, fromBlock, anchor) =>
      relayOperation("read ledger paid claims", async () => {
        const provider = rpcAt(rpcUrl);
        const times = new Map<number, number>();
        return ledgerEventPage(
          provider,
          ledger,
          ["WithdrawalPaid"],
          cursor,
          fromBlock,
          async (event) => {
            if (typeof event.block_number !== "number" || typeof event.block_hash !== "string")
              throw new Error("payment_block_missing");
            let time = times.get(event.block_number);
            if (time === undefined) {
              const block = await readConfirmedLedgerHead(provider, event.block_number);
              if (BigInt(block.hash) !== BigInt(event.block_hash)) throw new Error("payment_block_unconfirmed");
              time = block.time;
              times.set(event.block_number, time);
            }
            return { ...decodePayment(event), paidAt: time };
          },
          anchor,
        );
      }),
    postedResults: (cursor, fromBlock, anchor) =>
      relayOperation("read ledger posted results", () =>
        ledgerEventPage(rpcAt(rpcUrl), ledger, ["ResultsApplied"], cursor, fromBlock, decodeResult, anchor),
      ),
  };
};

const ledgerEventPage = async <A>(
  provider: RpcProvider,
  ledger: LedgerContract,
  names: readonly string[],
  after: string | null,
  saved: number | undefined,
  decode: (event: EmittedEvent, index: number, position: string) => A | Promise<A>,
  previous?: LedgerAnchor,
): Promise<LedgerPage<A>> => {
  const address = ledger.contractAddress;
  const selectors = names.map((name) => hash.getSelectorFromName(name));
  const { cursor, rewind } = await eventCheckpoint(provider, after, saved, previous);
  const fromBlock = await ledgerHistoryFrom(provider, ledger, rewind ? undefined : saved);
  const anchor = { number: cursor.head, hash: cursor.hash };
  if (fromBlock > cursor.head) return { rows: [], head: cursor.head, next: null, anchor, rewind, fromBlock };
  const page = await provider.getEvents({
    address,
    from_block: { block_number: fromBlock },
    to_block: { block_number: cursor.head },
    keys: [selectors],
    chunk_size: 100,
    ...(cursor.token ? { continuation_token: cursor.token } : {}),
  });
  const rows: A[] = [];
  for (const [index, event] of page.events.entries()) {
    if (
      BigInt(event.from_address) !== BigInt(address) ||
      !selectors.some((selector) => BigInt(event.keys[0] ?? "0") === BigInt(selector))
    )
      throw new Error("invalid_ledger_event");
    const position = `${fromBlock}:${cursor.head}:${hash.starknetKeccak(cursor.token ?? "").toString(16)}`;
    rows.push(await decode(event, index, position));
  }
  if (BigInt((await readConfirmedLedgerHead(provider, cursor.head)).hash) !== BigInt(cursor.hash))
    throw new Error("ledger_event_head_changed");
  return {
    rows,
    head: cursor.head,
    anchor,
    rewind,
    fromBlock,
    next: page.continuation_token ? JSON.stringify({ ...cursor, token: page.continuation_token }) : null,
  };
};
const eventCheckpoint = async (
  provider: RpcProvider,
  after: string | null,
  saved: number | undefined,
  previous?: LedgerAnchor,
) => {
  const latest = await readConfirmedLedgerHead(provider);
  const page = after === null ? null : readCursor(after);
  const pinned = previous ?? (page?.hash ? { number: page.head, hash: page.hash } : undefined);
  const fresh = { head: latest.number, hash: latest.hash, token: "" };
  // A saved block or page without its anchor cannot be trusted to continue: scan again from the start.
  if (!pinned) return { cursor: fresh, rewind: saved !== undefined || page !== null };
  // A head below the anchor proves nothing: a load-balanced RPC can answer from a node a block behind. Only a different
  // hash at the anchored block is a rewrite.
  if (pinned.number > latest.number) throw new Error("ledger_head_behind_anchor");
  if (BigInt((await readConfirmedLedgerHead(provider, pinned.number)).hash) !== BigInt(pinned.hash))
    return { cursor: fresh, rewind: true };
  if (!page) return { cursor: fresh, rewind: false };
  if (page.head !== pinned.number || page.hash !== pinned.hash) throw new Error("ledger_cursor_anchor_differs");
  return { cursor: { head: page.head, hash: pinned.hash, token: page.token }, rewind: false };
};
const readCursor = (value: string): { head: number; token: string; hash?: string } => {
  const cursor = JSON.parse(value) as { head?: unknown; token?: unknown; hash?: unknown };
  if (!Number.isSafeInteger(cursor.head) || Number(cursor.head) < 0 || typeof cursor.token !== "string")
    throw new Error("invalid_ledger_cursor");
  if (cursor.hash !== undefined && (typeof cursor.hash !== "string" || !/^0x[0-9a-f]+$/i.test(cursor.hash)))
    throw new Error("invalid_ledger_cursor");
  return {
    head: Number(cursor.head),
    token: cursor.token,
    ...(typeof cursor.hash === "string" ? { hash: cursor.hash } : {}),
  };
};
const decodePayment = (event: EmittedEvent): Omit<PaidClaim, "paidAt"> => {
  if (
    event.keys.length !== 3 ||
    event.data.length !== 6 ||
    typeof event.transaction_hash !== "string" ||
    !/^0x[0-9a-fA-F]{1,64}$/.test(event.transaction_hash) ||
    BigInt(event.transaction_hash) === 0n
  )
    throw new Error("invalid_payment_event");
  return {
    chainId: event.keys[1]!,
    paymentTransactionHash: event.transaction_hash,
    transactionHash: event.keys[2]!,
    seasonId: ledgerInteger(event.data[0]!),
    wallet: event.data[1]!,
    amount: ledgerU256(event.data[2]!, event.data[3]!),
    prizeRank: ledgerInteger(event.data[4]!),
    prizeCount: ledgerInteger(event.data[5]!),
  };
};
const decodeResult = (event: EmittedEvent): BlitzCommitment => {
  if (event.keys.length !== 3 || event.data.length !== 5) throw new Error("invalid_result_event");
  return { chainId: event.keys[1]!, gameId: ledgerInteger(event.keys[2]!), commitment: event.data[2]! };
};
/** Requested and opened events share one ordered cursor, so historical completed chests leave no polling debt. */
export const ledgerChestChanges = (
  rpcUrl: string,
  ledger: LedgerContract,
  fromBlock: number | undefined,
  cursor: string | null,
  anchor?: LedgerAnchor,
) =>
  relayOperation(
    "read chest requests",
    (): Promise<ChestPage> =>
      ledgerEventPage(
        rpcAt(rpcUrl),
        ledger,
        ["ChestRequested", "ChestOpened"],
        cursor,
        fromBlock,
        decodeChestChange,
        anchor,
      ),
  );

const decodeChestChange = (event: EmittedEvent): ChestChange => {
  if (event.keys.length !== 4) throw new Error("invalid_chest_event");
  const tokenId = ledgerU256(event.keys[1]!, event.keys[2]!);
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
