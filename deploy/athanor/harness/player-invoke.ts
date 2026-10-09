import {
  Account,
  BlockTag,
  EDAMode,
  EDataAvailabilityMode,
  hash,
  type Call,
  type Calldata,
  type InvocationsSignerDetails,
} from "starknet";

export interface PlayBounds {
  chainId: string;
  l2GasBound: string;
}
const felt = (value: string | number | bigint) => `0x${BigInt(value).toString(16)}`;

/** The bound is an immutable contract pin, never a driver estimate or a fallback. */
export function readPlayBounds(manifest: unknown): PlayBounds {
  const shard = (
    manifest as { shard?: { chainId?: string; l2GasBound?: string; vrfPublicKey?: { x?: string; y?: string } } }
  ).shard;
  const bound = shard?.l2GasBound;
  if (
    !shard?.chainId ||
    !shard.vrfPublicKey?.x ||
    !shard.vrfPublicKey.y ||
    !bound ||
    !/^0x[1-9a-f][0-9a-f]*$/.test(bound) ||
    BigInt(bound) >= 2n ** 64n
  )
    throw new Error("Manifest requires shard chainId, vrfPublicKey and canonical nonzero u64 l2GasBound");
  return { chainId: felt(shard.chainId), l2GasBound: bound };
}

/** Ordinary v3 signing and hash calculation lifted from the measured node-first driver. The proxy stamps it. */
export async function signPlayerInvoke(account: Account, call: Call, bounds: PlayBounds) {
  const resourceBounds = {
    l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
    l2_gas: { max_amount: BigInt(bounds.l2GasBound), max_price_per_unit: 0n },
    l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
  };
  const details: InvocationsSignerDetails = {
    walletAddress: account.address,
    nonce: await account.getNonce(BlockTag.PRE_CONFIRMED),
    chainId: bounds.chainId as InvocationsSignerDetails["chainId"],
    cairoVersion: "1",
    version: "0x3",
    resourceBounds,
    tip: 0n,
    paymasterData: [],
    accountDeploymentData: [],
    nonceDataAvailabilityMode: EDataAvailabilityMode.L1,
    feeDataAvailabilityMode: EDataAvailabilityMode.L1,
  };
  const invocation = await account.buildInvocation([call], details);
  if (!Array.isArray(invocation.calldata) || !invocation.calldata.every((value) => typeof value === "string"))
    throw new Error("Uncompiled player invocation");
  const calldata = invocation.calldata as Calldata;
  const signature = invocation.signature as string[];
  if (signature.length !== 3) throw new Error("Player invoke requires the ordinary three-felt device signature");
  const transactionHash = hash.calculateInvokeTransactionHash({
    ...details,
    senderAddress: account.address,
    compiledCalldata: calldata,
    nonceDataAvailabilityMode: EDAMode.L1,
    feeDataAvailabilityMode: EDAMode.L1,
  });
  const transaction = {
    type: "INVOKE",
    version: "0x3",
    sender_address: account.address,
    nonce: felt(details.nonce as string),
    calldata: calldata.map(felt),
    signature: signature.map(felt),
    resource_bounds: Object.fromEntries(
      Object.entries(resourceBounds).map(([key, value]) => [
        key,
        { max_amount: felt(value.max_amount), max_price_per_unit: felt(value.max_price_per_unit) },
      ]),
    ),
    tip: "0x0",
    paymaster_data: [],
    account_deployment_data: [],
    nonce_data_availability_mode: "L1",
    fee_data_availability_mode: "L1",
  };
  return {
    hash: felt(transactionHash),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "starknet_addInvokeTransaction", params: [transaction] }),
  };
}

/** Games.play has one published command span; every producer uses the same pins and length encoding. */
export function buildPlayCall(
  games: string,
  gameId: number,
  releaseId: number,
  presetCommitment: string | bigint,
  command: readonly string[],
): Call {
  return {
    contractAddress: games,
    entrypoint: "play",
    calldata: [String(gameId), String(releaseId), String(presetCommitment), String(command.length), ...command],
  };
}
