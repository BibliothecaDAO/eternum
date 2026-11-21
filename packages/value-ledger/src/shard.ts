import { DeviceSigner } from "@bibliothecadao/eternum/device-signer";
import { batchRemaining } from "@bibliothecadao/provider/batch-progress";
import { Account, CallData, ec, type Abi, type BlockIdentifier, type RpcProvider } from "starknet";
import { encodeNativeCommand, gameplayRejection } from "@bibliothecadao/provider";
import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum/shard-fees";
import { readConfirmedLedgerHead } from "./codecs";
import { rpcAt } from "./rpc";
import { assertAbiArguments, readShardAbi } from "./shard-abi";
import type { AdminEntrypointName, GameEntrypointName } from "./shard-entrypoints";
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
  private adminAbi?: Promise<Abi>;
  private bound?: Promise<bigint>;
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

  async view<A>(entrypoint: string, calldata: readonly (string | number | bigint)[], at?: BlockIdentifier): Promise<A> {
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
  async admin(entrypoint: AdminEntrypointName, args: Record<string, unknown>) {
    return this.invoke(entrypoint, ...(await this.adminCall(entrypoint, args)));
  }
  private async adminCall(entrypoint: AdminEntrypointName, args: Record<string, unknown>): Promise<[string[], bigint]> {
    this.adminAbi ??= this.head().then(({ block_number }) =>
      readShardAbi(this.provider, this.target.gamesAddress, block_number),
    );
    const abi = await this.adminAbi;
    assertAbiArguments(abi, entrypoint, args);
    const calldata = new CallData(abi).compile(entrypoint, args as Parameters<CallData["compile"]>[1]);
    return [calldata, await this.gasBound()];
  }
  /** The shard's per-transaction gas bound, fixed at its deployment: read once per operator. */
  private gasBound() {
    this.bound ??= this.view<bigint>("l2_gas_bound", []);
    return this.bound;
  }
  async pins(gameId: number): Promise<PlayPins> {
    return {
      gameId,
      release: await this.view<bigint>("game_release", [gameId]),
      l2GasBound: await this.gasBound(),
    };
  }
  async markGameSettled(gameId: number) {
    return this.play(await this.pins(gameId), "MarkGameSettled");
  }
  async settleGame(gameId: number) {
    while (!(await this.view<{ settled: boolean }>("game", [gameId])).settled) {
      const result = await this.markGameSettled(gameId);
      const remaining = batchRemaining(result.events, this.target.gamesAddress, result.transactionHash, {
        gameId,
        missing: "reject",
      });
      if (!remaining && !(await this.view<{ settled: boolean }>("game", [gameId])).settled)
        throw new Error("point_settlement_not_complete");
    }
  }
  private play(pins: PlayPins, name: AdminPlay) {
    return this.invoke("play", playCalldata(pins, name), pins.l2GasBound);
  }
  private async codec(head: BlockIdentifier) {
    return new CallData(await readShardAbi(this.provider, this.target.gamesAddress, head));
  }
  private async invoke(entrypoint: GameEntrypointName, calldata: string[], bound: bigint) {
    const submitted = await this.submit(entrypoint, calldata, bound);
    const receipt = await closedBlockReceipt(this.provider, submitted.transaction_hash);
    const refusal = gameplayRejection(receipt.events, this.target.gamesAddress, submitted.transaction_hash);
    if (refusal) throw new Error(`gameplay_refused:${refusal.reason}`);
    return { transactionHash: submitted.transaction_hash, events: receipt.events };
  }
  private submit(entrypoint: GameEntrypointName, calldata: string[], bound: bigint) {
    return this.account.execute(
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
  }
}

const playCalldata = (pins: PlayPins, name: AdminPlay) => {
  const command = encodeNativeCommand(bindings.commandAbi, { kind: name, value: undefined });
  return [String(pins.gameId), String(pins.release), String(command.length), ...command];
};

export interface PlayPins {
  gameId: number;
  release: bigint;
  l2GasBound: bigint;
}
type AdminPlay = "MarkGameSettled";

const CLOSED = ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"] as const;
const closedBlockReceipt = (provider: RpcProvider, transactionHash: string) =>
  pollReceipt(provider, transactionHash, CLOSED, 250, 30_000);

/** The public proxy masks missing receipts; polling transport errors is bounded and never assumes inclusion. */
const pollReceipt = async (
  provider: RpcProvider,
  transactionHash: string,
  finality: readonly string[],
  intervalMs: number,
  waitMs: number,
) => {
  for (let waited = 0; waited < waitMs; waited += intervalMs) {
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
