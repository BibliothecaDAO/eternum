import { Account, Signer, CallData, ec, stark, hash, byteArray, type Abi, type RpcProvider } from "starknet";
import { rpcAt } from "./rpc";

export interface ShardTarget {
  rpcUrl: string;
  chainId: string;
  gamesAddress: string;
  accountAddress: string;
  privateKey: string;
}

class DeviceSigner extends Signer {
  constructor(private readonly deviceKey: string) {
    super(deviceKey);
  }
  override async signRaw(digest: string): Promise<string[]> {
    return [ec.starkCurve.getStarkKey(this.deviceKey), ...stark.formatSignature(await super.signRaw(digest))];
  }
}

/** Administrative invokes and stamped play use the same approved device and public RPC, with no fee estimation. */
export class ShardOperator {
  readonly provider: RpcProvider;
  private readonly account: Account;
  constructor(readonly target: ShardTarget) {
    this.provider = rpcAt(target.rpcUrl);
    this.account = new Account({
      provider: this.provider,
      address: target.accountAddress,
      signer: new DeviceSigner(target.privateKey),
      cairoVersion: "1",
    });
  }
  async head() {
    if (BigInt(await this.provider.getChainId()) !== BigInt(this.target.chainId))
      throw new Error("shard_chain_differs");
    const block = await this.provider.getBlock("latest");
    if (
      !("block_number" in block) ||
      !("status" in block) ||
      !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(block.status ?? "")
    )
      throw new Error("shard_head_unconfirmed");
    return block;
  }
  async view<A>(entrypoint: string, calldata: readonly (string | number | bigint)[], at?: number): Promise<A> {
    const head = at ?? (await this.head()).block_number;
    const codec = await this.codec(head);
    const fields = await this.provider.callContract(
      { contractAddress: this.target.gamesAddress, entrypoint, calldata: calldata.map(String) },
      head,
    );
    const value = codec.parse(entrypoint, fields);
    return (
      value && typeof value === "object" && Object.keys(value).length === 1 && "" in value ? value[""] : value
    ) as A;
  }
  async admin(entrypoint: string, args: Record<string, unknown>) {
    const codec = await this.codec((await this.head()).block_number);
    return this.invoke(entrypoint, codec.compile(entrypoint, args as Parameters<CallData["compile"]>[1]));
  }
  async play(gameId: number, command: readonly string[]) {
    const game = await this.view<{ preset_id: bigint }>("game", [gameId]);
    const release = await this.view<bigint>("game_release", [gameId]);
    const commitment = await this.view<bigint>("preset_commitment", [game.preset_id]);
    return this.invoke("play", [
      String(gameId),
      String(release),
      String(commitment),
      String(command.length),
      ...command,
    ]);
  }
  private async codec(head: number) {
    const contract = await this.provider.getClassAt(this.target.gamesAddress, head);
    const abi = typeof contract.abi === "string" ? JSON.parse(contract.abi) : contract.abi;
    if (!Array.isArray(abi)) throw new Error("shard_abi_unavailable");
    return new CallData(abi as Abi);
  }
  private async invoke(entrypoint: string, calldata: string[]) {
    const bound = await this.view<bigint>("l2_gas_bound", []);
    const submitted = await this.account.execute(
      { contractAddress: this.target.gamesAddress, entrypoint, calldata },
      {
        tip: 0,
        resourceBounds: {
          l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
          l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
          l2_gas: { max_amount: bound, max_price_per_unit: 0n },
        },
        paymasterData: [],
        accountDeploymentData: [],
        nonceDataAvailabilityMode: "L1",
        feeDataAvailabilityMode: "L1",
      },
    );
    const receipt = await confirmedShardReceipt(this.provider, submitted.transaction_hash);
    rejectGameplayRefusal(receipt.events, this.target.gamesAddress, submitted.transaction_hash);
    return { transactionHash: submitted.transaction_hash, events: receipt.events };
  }
}

/** The public proxy masks missing receipts; polling transport errors is bounded and never assumes inclusion. */
const confirmedShardReceipt = async (provider: RpcProvider, transactionHash: string) => {
  for (let attempt = 0; attempt < 120; attempt++) {
    let receipt;
    try {
      receipt = await provider.getTransactionReceipt(transactionHash);
    } catch {
      /* Retry the same hash. */
    }
    if (
      receipt &&
      "block_number" in receipt &&
      ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(receipt.finality_status)
    ) {
      if (receipt.isReverted()) throw new Error("shard_invoke_reverted");
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("shard_receipt_unavailable");
};

const rejectGameplayRefusal = (
  events: readonly { from_address: string; keys: string[]; data: string[] }[],
  address: string,
  transactionHash: string,
) => {
  const rejected = events.filter(
    (event) =>
      BigInt(event.from_address) === BigInt(address) &&
      BigInt(event.keys[0] ?? "0") === BigInt(hash.getSelectorFromName("GameplayRejected")),
  );
  if (!rejected.length) return;
  const event = rejected[0]!;
  if (
    rejected.length !== 1 ||
    event.keys.length !== 5 ||
    BigInt(event.keys[1]!) !== 1n ||
    BigInt(event.keys[4]!) !== BigInt(transactionHash)
  )
    throw new Error("invalid_gameplay_rejection");
  const words = Number(BigInt(event.data[1]!));
  if (!Number.isInteger(words) || words < 0 || event.data.length !== words + 4)
    throw new Error("invalid_rejection_reason");
  const reason = byteArray.stringFromByteArray({
    data: event.data.slice(2, 2 + words),
    pending_word: event.data[2 + words]!,
    pending_word_len: Number(BigInt(event.data[3 + words]!)),
  });
  throw new Error(`gameplay_refused:${reason}`);
};

export const batchRemaining = (
  events: readonly { from_address: string; keys: string[]; data: string[] }[],
  address: string,
  gameId: number,
  transactionHash: string,
): bigint => {
  const rows = events.filter(
    (event) =>
      BigInt(event.from_address) === BigInt(address) &&
      BigInt(event.keys[0] ?? "0") === BigInt(hash.getSelectorFromName("BatchProgress")),
  );
  if (
    rows.length !== 1 ||
    rows[0]!.keys.length !== 2 ||
    rows[0]!.data.length !== 3 ||
    BigInt(rows[0]!.keys[1]!) !== BigInt(gameId) ||
    BigInt(rows[0]!.data[1]!) !== BigInt(transactionHash)
  )
    throw new Error("batch_progress_missing_or_invalid");
  const remaining = BigInt(rows[0]!.data[2]!);
  if (remaining < 0n || remaining >= 2n ** 64n) throw new Error("invalid_batch_remaining");
  return remaining;
};
