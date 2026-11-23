import {
  decodeFrontierSeason,
  isDeploymentBlock,
  rpcAt,
  ledgerInteger,
  ledgerU256,
  readConfirmedLedgerHead,
  readFinalLedgerHead,
  isContractRevert,
} from "@realms-world/value-ledger";
import { hash, RpcProvider, type EmittedEvent } from "starknet";
import {
  relayOperation,
  type ChestChange,
  type ChestPage,
  type LedgerPage,
  type LedgerAnchor,
  type PaidClaim,
  type PostedResult,
  type ReportedClaim,
  type MonitorPorts,
} from "./ports";

/** The ledger as its history readers need it: its address and the block it was deployed in. */
export interface LedgerContract {
  contractAddress: string;
  deploymentBlock: number;
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
/** Confirmed ledger events are the monitor's enumeration; each cursor pins the head across all pages. */
export const ledgerMonitorReads = (
  rpcUrl: string,
  ledger: LedgerContract,
): Pick<
  MonitorPorts["ledger"],
  "reportedClaims" | "paidClaims" | "postedResults" | "frontierPool" | "finalFrontierPool"
> => {
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
    finalFrontierPool: (chainId, gameId) =>
      relayOperation("read final ledger Frontier pool", async () => {
        const provider = rpcAt(rpcUrl);
        const final = await readFinalLedgerHead(provider);
        try {
          const season = decodeFrontierSeason(
            await provider.callContract(
              { contractAddress: address, entrypoint: "get_frontier", calldata: [chainId, String(gameId)] },
              final.number,
            ),
          );
          return { pool: season.pool, block: final.number, hash: final.hash };
        } catch (error) {
          if (isContractRevert(error, "Ledger: unknown Frontier season")) return null;
          throw error;
        }
      }),
    reportedClaims: (cursor, fromBlock, anchor) =>
      relayOperation("read ledger reported claims", () =>
        ledgerEventPage(rpcAt(rpcUrl), ledger, ["WithdrawalReported"], cursor, fromBlock, decodeReport, anchor),
      ),
    postedResults: (cursor, fromBlock, anchor) =>
      relayOperation("read ledger posted results", () =>
        ledgerEventPage(rpcAt(rpcUrl), ledger, ["ResultsApplied"], cursor, fromBlock, decodeResult, anchor),
      ),
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
const decodeResult = (event: EmittedEvent): PostedResult => {
  if (event.keys.length !== 3 || event.data.length !== 5) throw new Error("invalid_result_event");
  return { chainId: event.keys[1]!, gameId: ledgerInteger(event.keys[2]!), commitment: event.data[2]! };
};
const decodeReport = (event: EmittedEvent): ReportedClaim => {
  const { paymentTransactionHash, ...report } = decodePayment(event);
  return { ...report, reportTransactionHash: paymentTransactionHash };
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
