import { hash, shortString, type RpcProvider } from "starknet";
import { rpcAt } from "./rpc";

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
  transactions: { transaction: { transaction_hash: string }; receipt: ShardReceipt }[];
}
export interface ValueRow {
  model: string;
  keys: string[];
  values: string[];
  transactionHash: string;
}
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
  async block(number: number): Promise<{ block: ShardBlock; rows: ValueRow[] }> {
    const provider = this.provider();
    await this.assertChain(provider);
    const block = (await provider.getBlockWithReceipts(number)) as unknown as ShardBlock;
    validateHeader(block, number);
    if (!Array.isArray(block.transactions)) throw new Error("invalid_confirmed_transactions");
    const receipts = block.transactions.map(({ transaction, receipt }) => {
      if (!receipt || !transaction || !sameFelt(transaction.transaction_hash, receipt.transaction_hash))
        throw new Error("receipt_transaction_differs");
      return receipt;
    });
    const relevant = receipts.some((receipt) =>
      receipt.events?.some((event) => sameFelt(event.from_address, this.connection.gamesAddress)),
    );
    const prefixes = relevant ? await this.prefixes(provider, number) : [];
    return { block, rows: receipts.flatMap((receipt) => this.rows(receipt, prefixes)) };
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
  private async prefixes(provider: RpcProvider, number: number) {
    const contract = await provider.getClassAt(this.connection.gamesAddress, number);
    return rowSetPrefixes(contract.abi);
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
      const name = ["LordsWithdrawal", "BlitzResult", "LordsBudget", "ChestRules", "LaborGrant"].find((name) =>
        sameFelt(model, shortString.encodeShortString(name)),
      );
      if (!name) return [];
      if (
        receipt.execution_status !== "SUCCEEDED" ||
        (receipt.finality_status && !isConfirmed(receipt.finality_status))
      )
        throw new Error("unconfirmed_value_receipt");
      const frame = rowFrame(event.data);
      return [{ model: name, ...frame, transactionHash: felt(receipt.transaction_hash) }];
    });
    return rows;
  }
}

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
  if (!prefixes.length) throw new Error("rowset_abi_unavailable");
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
  return `0x${BigInt(value).toString(16)}`;
};
export const sameFelt = (left: string, right: string | undefined): boolean =>
  right !== undefined && BigInt(felt(left)) === BigInt(felt(right));
export const uint = (value: string, bits: number): bigint => {
  if (typeof value !== "string" || !/^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) throw new Error("invalid_integer_text");
  const n = BigInt(value);
  if (n < 0n || n >= 2n ** BigInt(bits)) throw new Error("invalid_unsigned_integer");
  return n;
};
