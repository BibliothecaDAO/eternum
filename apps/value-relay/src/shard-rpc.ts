import { normalizeStarknetAddress, isSameStarknetAddress } from "../../../packages/identity/src/address";
import { RelayFailure } from "./failure";
import { SHARD_PAGE_BLOCKS } from "./ports";
import { hash, shortString, type RpcProvider } from "starknet";
import { readClassAbi, readShardAbi } from "../../../packages/value-ledger/src/shard-abi";
import { rpcAt, rpcBatch, SHARD_RPC_MAX_BATCH_CALLS } from "../../../packages/value-ledger/src/rpc";

export interface ShardConnection {
  rpcUrl: string;
  gamesAddress: string;
  chainId: string;
}
interface ShardEvent {
  from_address: string;
  keys: string[];
  data: string[];
}
interface ShardReceipt {
  transaction_hash: string;
  block_number: number;
  block_hash: string;
  execution_status: string;
  finality_status?: string;
  events: ShardEvent[];
}
interface ShardBlock {
  block_number: number;
  block_hash: string;
  parent_hash: string;
  timestamp: number;
  status: "ACCEPTED_ON_L2" | "ACCEPTED_ON_L1";
  transactions?: string[];
}
export interface ValueRow {
  blockNumber?: number;
  model: string;
  keys: string[];
  values: string[];
  transactionHash: string;
}
const VALUE_MODELS = ["LordsWithdrawal", "BlitzResult"] as const;
/** Header batches in flight at once: a Worker holds at most six connections. */
const HEADER_BATCHES_IN_FLIGHT = 4;

interface EventType {
  type: string;
  name: string;
  kind?: string;
  members?: { name: string; kind: string }[];
  variants?: { name: string; type: string; kind: string }[];
}

/** Reads bind chain, emitter and ABI at the confirmed block; no bundled historical schema decodes new value rows. */
export class ShardReader {
  constructor(readonly connection: ShardConnection) {}
  provider(): RpcProvider {
    return rpcAt(this.connection.rpcUrl);
  }
  async head(): Promise<number> {
    return (await this.header("latest")).block_number;
  }
  async header(number: number | "latest"): Promise<ShardBlock> {
    const provider = this.provider();
    await this.assertChain(provider);
    const block = await provider.getBlock(number);
    validateHeader(block, number === "latest" ? undefined : number);
    return block;
  }
  /** Every confirmed header from `from` to `to`, read in batches the shard's public RPC accepts. */
  async headers(from: number, to: number): Promise<Map<number, ShardBlock>> {
    const batches: number[][] = [];
    for (let start = from; start <= to; start += SHARD_RPC_MAX_BATCH_CALLS)
      batches.push(Array.from({ length: Math.min(SHARD_RPC_MAX_BATCH_CALLS, to - start + 1) }, (_, i) => start + i));
    const headers = new Map<number, ShardBlock>();
    for (let index = 0; index < batches.length; index += HEADER_BATCHES_IN_FLIGHT)
      await Promise.all(
        batches.slice(index, index + HEADER_BATCHES_IN_FLIGHT).map(async (numbers) => {
          const blocks = await rpcBatch<unknown>(
            this.connection.rpcUrl,
            "starknet_getBlockWithTxHashes",
            numbers.map((number) => ({ block_id: { block_number: number } })),
          );
          blocks.forEach((block, i) => {
            validateHeader(block, numbers[i]);
            headers.set(numbers[i]!, block);
          });
        }),
      );
    return headers;
  }
  async page(
    from: number,
    to: number,
    cursor: string | null,
  ): Promise<{
    block: ShardBlock;
    first: ShardBlock;
    anchors: { number: number; hash: string }[];
    rows: (ValueRow & { confirmedAt: number })[];
    next: string | null;
  }> {
    const provider = this.provider();
    await this.assertChain(provider);
    const first = await this.header(from);
    const block = from === to ? first : await this.header(to);
    const prefixes = await this.prefixes(provider, to);
    const filters = valueEventFilters(prefixes);
    const position: { filter: number; token: string | null } = cursor ? JSON.parse(cursor) : { filter: 0, token: null };
    if (
      !Number.isInteger(position.filter) ||
      !filters[position.filter] ||
      (position.token !== null && typeof position.token !== "string")
    )
      throw new Error("invalid_shard_event_cursor");
    const page = await provider.getEvents({
      address: this.connection.gamesAddress,
      from_block: { block_number: from },
      to_block: { block_number: to },
      chunk_size: 100,
      keys: filters[position.filter]!,
      ...(position.token ? { continuation_token: position.token } : {}),
    });
    if (page.events.length > 100 || (page.continuation_token && page.continuation_token === position.token))
      throw new Error("invalid_shard_event_page");
    if (to - from >= SHARD_PAGE_BLOCKS) throw new Error("shard_block_range_too_large");
    const headers = new Map<number, ShardBlock>([
      [from, first],
      ...(await this.headers(from + 1, to - 1)),
      [to, block],
    ]);
    for (let number = from + 1; number <= to; number++)
      if (!sameFelt(headers.get(number)!.parent_hash, headers.get(number - 1)!.block_hash))
        throw new RelayFailure({ operation: `confirmed_block_changed:${number - 1}` });
    const rows: (ValueRow & { confirmedAt: number })[] = [];
    for (const event of page.events) {
      if (
        !sameFelt(event.from_address, this.connection.gamesAddress) ||
        typeof event.block_number !== "number" ||
        typeof event.block_hash !== "string" ||
        !Number.isSafeInteger(event.block_number) ||
        event.block_number < from ||
        event.block_number > to
      )
        throw new Error("invalid_confirmed_event");
      let header = headers.get(event.block_number);
      if (!header) {
        header = await this.header(event.block_number);
        headers.set(event.block_number, header);
      }
      if (!sameFelt(header.block_hash, event.block_hash))
        throw new RelayFailure({ operation: `confirmed_block_changed:${event.block_number}` });
      const receipt: ShardReceipt = {
        transaction_hash: event.transaction_hash,
        block_number: event.block_number,
        block_hash: event.block_hash,
        execution_status: "SUCCEEDED",
        finality_status: header.status,
        events: [event],
      };
      try {
        rows.push(...this.rows(receipt, prefixes).map((row) => ({ ...row, confirmedAt: header!.timestamp })));
      } catch {
        rows.push({
          model: "MalformedValueEvent",
          keys: event.keys,
          values: event.data,
          transactionHash: event.transaction_hash,
          blockNumber: event.block_number,
          confirmedAt: header.timestamp,
        });
      }
    }
    return {
      block,
      first,
      anchors: [...headers.values()]
        .sort((a, b) => a.block_number - b.block_number)
        .map((header) => ({ number: header.block_number, hash: header.block_hash })),
      rows,
      next: page.continuation_token
        ? JSON.stringify({ filter: position.filter, token: page.continuation_token })
        : position.filter + 1 < filters.length
          ? JSON.stringify({ filter: position.filter + 1, token: null })
          : null,
    };
  }
  async receipt(
    transactionHash: string,
  ): Promise<{ receipt: ShardReceipt; rows: ValueRow[]; timestamp: number } | null> {
    const provider = this.provider();
    await this.assertChain(provider);
    let receipt: ShardReceipt & { block_number: number; block_hash: string };
    try {
      receipt = (await provider.getTransactionReceipt(transactionHash)) as unknown as typeof receipt;
    } catch (error) {
      if (isMissingTransaction(error)) return null;
      throw error;
    }
    if (
      !Number.isSafeInteger(receipt.block_number) ||
      receipt.block_number < 0 ||
      !receipt.finality_status ||
      !isConfirmed(receipt.finality_status)
    )
      throw new Error("unconfirmed_transaction_receipt");
    if (!sameFelt(receipt.transaction_hash, transactionHash)) throw new Error("receipt_transaction_differs");
    const header = await provider.getBlock(receipt.block_number);
    validateHeader(header, receipt.block_number);
    if (!sameFelt(header.block_hash, receipt.block_hash)) throw new Error("receipt_block_changed");
    return {
      receipt,
      rows: this.rows(receipt, await this.prefixes(provider, receipt.block_number)),
      timestamp: header.timestamp,
    };
  }
  private async assertChain(provider: RpcProvider) {
    if (!sameFelt(await provider.getChainId(), this.connection.chainId)) throw new Error("shard_chain_differs");
  }
  /**
   * Every RowSet path the Games contract emits at a block: its own, and those of each registered release's logic
   * classes, which it runs by library call and which emit from its address under their own event enums.
   */
  private async prefixes(provider: RpcProvider, number: number) {
    const address = this.connection.gamesAddress;
    const games = await readShardAbi(provider, address, number);
    const prefixes = rowSetPrefixes(games);
    for (const classHash of await releaseClasses(provider, address, number, games))
      prefixes.push(...(await logicClassPrefixes(provider, classHash)));
    const unique = new Map(prefixes.map((prefix) => [prefix.map(felt).join(), prefix]));
    if (!unique.size) throw new Error("rowset_abi_unavailable");
    return [...unique.values()];
  }

  private rows(receipt: ShardReceipt, prefixes: string[][]): ValueRow[] {
    if (!Array.isArray(receipt.events)) throw new Error("invalid_receipt_events");
    const rows = receipt.events.flatMap((event) => {
      if (!sameFelt(event.from_address, this.connection.gamesAddress)) return [];
      const prefix = prefixes.find((prefix) => prefix.every((key, index) => sameFelt(key, event.keys[index])));
      if (!prefix) return [];
      if (event.keys.length !== prefix.length + 2 || uint(event.keys[prefix.length]!, 8) !== 1n)
        throw new Error("invalid_rowset_header");
      const model = event.keys[prefix.length + 1]!;
      const name = VALUE_MODELS.find((name) => sameFelt(model, shortString.encodeShortString(name)));
      if (!name) return [];
      if (
        receipt.execution_status !== "SUCCEEDED" ||
        (receipt.finality_status && !isConfirmed(receipt.finality_status))
      )
        throw new Error("unconfirmed_value_receipt");
      const frame = rowFrame(event.data);
      return [
        { model: name, ...frame, transactionHash: felt(receipt.transaction_hash), blockNumber: receipt.block_number },
      ];
    });
    return rows;
  }
}

// Equal-depth aliases share key positions; decoding still checks the exact deployed prefix.
const valueEventFilters = (prefixes: string[][]): string[][][] => {
  const byDepth = new Map<number, string[][]>();
  for (const prefix of prefixes) {
    const keys = byDepth.get(prefix.length) ?? prefix.map(() => [] as string[]);
    prefix.forEach((key, index) => {
      if (!keys[index]!.includes(key)) keys[index]!.push(key);
    });
    byDepth.set(prefix.length, keys);
  }
  return [...byDepth.values()].map((keys) => [...keys, ["0x1"], VALUE_MODELS.map(shortString.encodeShortString)]);
};

/** Each logic class's RowSet paths, by class hash: class content is immutable, and a path is a few felts. */
const logicPrefixes = new Map<string, string[][]>();
const logicClassPrefixes = async (provider: RpcProvider, classHash: string) => {
  let prefixes = logicPrefixes.get(classHash);
  if (!prefixes) {
    prefixes = rowSetPrefixes(await readClassAbi(provider, classHash));
    logicPrefixes.set(classHash, prefixes);
  }
  return prefixes;
};

/** The logic and migration classes of every release the Games contract has registered by a block. */
const releaseClasses = async (
  provider: RpcProvider,
  address: string,
  number: number,
  games: unknown,
): Promise<string[]> => {
  const call = (entrypoint: string, calldata: string[]) =>
    provider.callContract({ contractAddress: address, entrypoint, calldata }, number);
  const [current] = await call("current_release", []);
  const classes = new Set<string>();
  const layout = BigInt(current ?? "0") > 0n ? releaseLayout(games) : null;
  for (let release = 1n; layout && release <= BigInt(current!); release++) {
    const answer = await call("release", [release.toString()]);
    if (answer.length !== layout.size) throw new Error("invalid_release_classes");
    // A zero migration class is a release that migrates nothing.
    for (const position of layout.classes) if (BigInt(answer[position]!) !== 0n) classes.add(felt(answer[position]!));
  }
  return [...classes];
};

const CLASS_HASH = "core::starknet::class_hash::ClassHash";
const ONE_FELT = new Set(["core::felt252", "core::integer::u8", "core::integer::u16", "core::integer::u32"]);

/**
 * Where the class hashes sit in `release`'s answer, and its length, read from the Games ABI's Release type: a logic
 * class split off in a new release needs no relay change. A field the walk cannot size is refused, never guessed.
 */
const releaseLayout = (raw: unknown): { size: number; classes: number[] } => {
  const abi = (typeof raw === "string" ? JSON.parse(raw) : raw) as {
    type: string;
    name?: string;
    items?: unknown[];
    outputs?: { type: string }[];
    members?: { type: string }[];
  }[];
  const items = abi.flatMap((item) => (item.type === "interface" ? (item.items as typeof abi) : [item]));
  const entry = items.find((item) => item.type === "function" && item.name === "release");
  if (entry?.outputs?.length !== 1) throw new Error("release_abi_unavailable");
  const structs = new Map(items.filter((item) => item.type === "struct").map((item) => [item.name, item]));
  const layout = { size: 0, classes: [] as number[] };
  const walk = (type: string, within: string[]) => {
    if (type === CLASS_HASH) layout.classes.push(layout.size++);
    else if (ONE_FELT.has(type)) layout.size++;
    else {
      const struct = structs.get(type);
      if (!struct?.members || within.includes(type)) throw new Error("unsupported_release_abi");
      for (const member of struct.members) walk(member.type, [...within, type]);
    }
  };
  walk(entry.outputs[0]!.type, []);
  return layout;
};

/** The RowSet paths one class declares; a class that emits no RowSet declares none. */
const rowSetPrefixes = (raw: unknown): string[][] => {
  const abi = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(abi)) throw new Error("shard_event_abi_unavailable");
  const events = abi.filter((item: EventType) => item.type === "event") as EventType[];
  const types = new Map(events.map((item) => [item.name, item]));
  const referenced = new Set(events.flatMap((event) => event.variants?.map((variant) => variant.type) ?? []));
  const prefixes: string[][] = [];
  const walk = (event: EventType, prefix: string[], seen: Set<string>) => {
    if (seen.has(event.name)) throw new Error("cyclic_event_abi");
    if (event.kind === "struct" && event.name.endsWith("::RowSet")) {
      if (
        event.members?.map((member) => `${member.name}:${member.kind}`).join() !==
          "version:key,model:key,keys:data,values:data" ||
        prefix.length === 0
      )
        throw new Error("unsupported_rowset_abi");
      prefixes.push(prefix);
      return;
    }
    for (const variant of event.variants ?? []) {
      const nested = types.get(variant.type);
      if (!nested) throw new Error("incomplete_event_abi");
      walk(
        nested,
        variant.kind === "flat" ? prefix : [...prefix, hash.getSelectorFromName(variant.name)],
        new Set([...seen, event.name]),
      );
    }
  };
  for (const root of events.filter((event) => !referenced.has(event.name))) walk(root, [], new Set());
  return prefixes;
};
const rowFrame = (data: string[]) => {
  let offset = 0;
  const span = () => {
    const length = Number(uint(data[offset++]!, 32));
    if (length > data.length - offset) throw new Error("invalid_row_span");
    const values = data.slice(offset, offset + length);
    offset += length;
    return values;
  };
  const keys = span();
  const values = span();
  if (offset !== data.length) throw new Error("trailing_row_data");
  return { keys, values };
};
function validateHeader(value: unknown, number?: number): asserts value is ShardBlock {
  const block = value as ShardBlock;
  if (
    !block ||
    !isConfirmed(block.status) ||
    !Number.isSafeInteger(block.block_number) ||
    block.block_number < 0 ||
    (number !== undefined && block.block_number !== number) ||
    !Number.isSafeInteger(block.timestamp) ||
    block.timestamp < 0
  )
    throw new Error("invalid_confirmed_header");
  felt(block.block_hash);
  felt(block.parent_hash);
}
const isConfirmed = (status: string) => ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(status);
const isMissingTransaction = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === 29;
export const felt = (value: string): string => {
  if (
    typeof value !== "string" ||
    !/^0x[0-9a-fA-F]{1,64}$/.test(value) ||
    BigInt(value) >= 2n ** 251n + 17n * 2n ** 192n + 1n
  )
    throw new Error("invalid_felt");
  return normalizeStarknetAddress(value);
};
export const sameFelt = (left: string, right: string | undefined): boolean =>
  right !== undefined && isSameStarknetAddress(felt(left), felt(right));
export const uint = (value: string, bits: number): bigint => {
  if (typeof value !== "string" || !/^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) throw new Error("invalid_integer_text");
  const n = BigInt(value);
  if (n < 0n || n >= 2n ** BigInt(bits)) throw new Error("invalid_unsigned_integer");
  return n;
};
