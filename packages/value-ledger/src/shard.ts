import { DeviceSigner } from "@bibliothecadao/eternum/device-signer";
export { batchRemaining } from "@bibliothecadao/provider/batch-progress";
import { Account, CallData, ec, type RpcProvider } from "starknet";
import { encodeNativeCommand, gameplayRejection } from "@bibliothecadao/provider";
import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum/shard-fees";
import { readConfirmedLedgerHead } from "./codecs";
import { rpcAt } from "./rpc";
import { readShardAbi } from "./shard-abi";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";

export interface ShardTarget {
  rpcUrl: string;
  chainId: string;
  gamesAddress: string;
  accountAddress: string;
  privateKey: string;
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
      signer: new DeviceSigner({
        privateKey: target.privateKey,
        publicKey: ec.starkCurve.getStarkKey(target.privateKey),
      }),
      cairoVersion: "1",
    });
  }
  async head() {
    if (BigInt(await this.provider.getChainId()) !== BigInt(this.target.chainId))
      throw new Error("shard_chain_differs");
    const block = await readConfirmedLedgerHead(this.provider);
    return { block_number: block.number, block_hash: block.hash, timestamp: block.time };
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
  async admin(entrypoint: string, args: Record<string, unknown>, onSubmitted?: (hash: string) => Promise<void>) {
    const codec = await this.codec((await this.head()).block_number);
    const bound = await this.view<bigint>("l2_gas_bound", []);
    const calldata = codec.compile(entrypoint, args as Parameters<CallData["compile"]>[1]);
    return this.invoke(entrypoint, calldata, bound, closedBlockReceipt, onSubmitted);
  }
  /** What every play of one game repeats: its release and preset pins and the shard's fixed gas bound. */
  async pins(gameId: number): Promise<PlayPins> {
    const game = await this.view<{ preset_id: bigint }>("game", [gameId]);
    return {
      gameId,
      release: await this.view<bigint>("game_release", [gameId]),
      commitment: await this.view<bigint>("preset_commitment", [game.preset_id]),
      l2GasBound: await this.view<bigint>("l2_gas_bound", []),
    };
  }
  async playCommand(gameId: number, name: "MarkGameSettled" | "RecordBlitzResults") {
    return this.play(await this.pins(gameId), name, closedBlockReceipt);
  }
  /**
   * Seats the roster's next player and waits only until the sequencer has executed it: the stamping RPC reads the
   * pre-confirmed nonce, so the next seat can follow at once instead of waiting for a closed block.
   */
  async seatNext(pins: PlayPins) {
    return this.play(pins, "SettleBlitzRoster", preConfirmedReceipt);
  }
  private play(pins: PlayPins, name: AdminPlay, receiptOf: ReceiptWait) {
    const command = encodeNativeCommand(bindings.commandAbi, { kind: name, value: undefined });
    const calldata = [String(pins.gameId), String(pins.release), String(pins.commitment), String(command.length)];
    return this.invoke("play", [...calldata, ...command], pins.l2GasBound, receiptOf);
  }
  private async codec(head: number) {
    return new CallData(await readShardAbi(this.provider, this.target.gamesAddress, head));
  }
  private async invoke(
    entrypoint: string,
    calldata: string[],
    bound: bigint,
    receiptOf: ReceiptWait,
    onSubmitted?: (hash: string) => Promise<void>,
  ) {
    const submitted = await this.account.execute(
      { contractAddress: this.target.gamesAddress, entrypoint, calldata },
      {
        tip: 0,
        resourceBounds: resolveGameTransactionResourceBounds(bound),
        paymasterData: [],
        accountDeploymentData: [],
        nonceDataAvailabilityMode: "L1",
        feeDataAvailabilityMode: "L1",
      },
    );
    if (onSubmitted) await onSubmitted(submitted.transaction_hash);
    const receipt = await receiptOf(this.provider, submitted.transaction_hash);
    const refusal = gameplayRejection(receipt.events, this.target.gamesAddress, submitted.transaction_hash);
    if (refusal) throw new Error(`gameplay_refused:${refusal.reason}`);
    return { transactionHash: submitted.transaction_hash, events: receipt.events };
  }
}

export interface PlayPins {
  gameId: number;
  release: bigint;
  commitment: bigint;
  l2GasBound: bigint;
}
type AdminPlay = "SettleBlitzRoster" | "MarkGameSettled" | "RecordBlitzResults";
type ReceiptWait = (provider: RpcProvider, transactionHash: string) => ReturnType<typeof pollReceipt>;

const closedBlockReceipt: ReceiptWait = (provider, transactionHash) =>
  pollReceipt(provider, transactionHash, ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"], 250);
const preConfirmedReceipt: ReceiptWait = (provider, transactionHash) =>
  pollReceipt(provider, transactionHash, ["PRE_CONFIRMED", "ACCEPTED_ON_L2", "ACCEPTED_ON_L1"], 50);

/** The public proxy masks missing receipts; polling transport errors is bounded and never assumes inclusion. */
const pollReceipt = async (
  provider: RpcProvider,
  transactionHash: string,
  finality: readonly string[],
  intervalMs: number,
) => {
  for (let waited = 0; waited < 30_000; waited += intervalMs) {
    let receipt;
    try {
      receipt = await provider.getTransactionReceipt(transactionHash);
    } catch {
      /* Retry the same hash. */
    }
    if (receipt && "finality_status" in receipt && finality.includes(receipt.finality_status)) {
      if (receipt.isReverted())
        throw new Error("shard_invoke_reverted", {
          cause: "revert_reason" in receipt ? receipt.revert_reason : undefined,
        });
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("shard_receipt_unavailable");
};
