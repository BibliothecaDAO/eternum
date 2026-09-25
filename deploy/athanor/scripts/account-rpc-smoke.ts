import { assertPublicRpcBoundary } from "./public-rpc-check";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { Account, BlockTag, ec, RpcProvider, stark } from "starknet";
import { DeviceSigner, deviceKeyOf, joinBotAccount } from "../../../packages/core/src/account/realms-account";

// The public RPC's account boundary, exercised from outside: its refusals, one real deployment of a fresh bot account
// with its first device, one operator invoke, and the device join and revoke shapes forwarded to the node. The operator
// route approves a bot's first device only, so the join and revoke are checked by fee estimation, not sent.
const [directory, url] = process.argv.slice(2);
if (!directory || !url) throw new Error("Usage: bun account-rpc-smoke.ts RUN_DIRECTORY PUBLIC_RPC_URL");
const env = Object.fromEntries(
  readFileSync(`${directory}/harness.env`, "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const manifest = JSON.parse(readFileSync(`${directory}/native-world.json`, "utf8"));
const { operatorAccountAddress: operator } = JSON.parse(readFileSync(`${directory}/gameplay-contracts.json`, "utf8"));
console.log(JSON.stringify(await assertPublicRpcBoundary(url, { ...manifest.shard, operator })));

const operatorToken = process.env.OPERATOR_TOKEN;
if (!operatorToken) {
  throw new Error(
    "The smoke deploys a bot account whose first device the operator route approves: it needs OPERATOR_TOKEN. " +
      "A community shard checks its boundary with inspect-shard-roles --public-rpc.",
  );
}
const provider = new RpcProvider({ nodeUrl: url, blockIdentifier: BlockTag.PRE_CONFIRMED });
const device = deviceKeyOf(`0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")}`);
const smoke = mkdtempSync(`${directory}/rpc-smoke-`);
writeFileSync(`${smoke}/device.json`, JSON.stringify(device), { mode: 0o600, flag: "wx" });

const bot = await joinBotAccount({
  provider,
  shard: manifest.shard,
  label: stark.randomAddress(),
  device,
  identity: { url: env.IDENTITY_URL, operatorToken },
});
const [deployed] = await provider.callContract(
  { contractAddress: bot.address, entrypoint: "is_device", calldata: [device.publicKey] },
  BlockTag.PRE_CONFIRMED,
);
if (BigInt(deployed) !== 1n) throw new Error("The bot account was not deployed with its device");

const owner = new Account({
  provider,
  address: operator,
  signer: new DeviceSigner(deviceKeyOf(env.DEPLOYER_PRIVATE_KEY)),
  cairoVersion: "1",
});
const operatorInvoke = await owner.execute(
  { contractAddress: operator, entrypoint: "device_change_counter", calldata: [] },
  { tip: 0 },
);
await provider.waitForTransaction(operatorInvoke.transaction_hash, { retryInterval: 250 });

const joinShape = await forwardedToNode(() =>
  bot.estimateInvokeFee(
    { contractAddress: bot.address, entrypoint: "is_device", calldata: [stark.randomAddress()] },
    { skipValidate: true, tip: 0 },
  ),
);
const revokeShape = await forwardedToNode(() =>
  bot.estimateInvokeFee(
    { contractAddress: bot.address, entrypoint: "revoke_device", calldata: [device.publicKey, "0x1", "0x2"] },
    { skipValidate: true, tip: 0 },
  ),
);
console.log(
  JSON.stringify({
    chainId: manifest.shard.chainId,
    deployedBot: bot.address,
    acceptedOperatorInvoke: operatorInvoke.transaction_hash,
    joinShape,
    revokeShape,
  }),
);

/**
 * Whether the proxy passed a request on: the node answering, even with an execution error (a revoke without the
 * guardian's approval reverts), means it was forwarded; the proxy's own refusal is method-not-found.
 */
async function forwardedToNode(estimate: () => Promise<unknown>): Promise<"estimated" | "executed-and-refused"> {
  try {
    await estimate();
    return "estimated";
  } catch (error) {
    if (rpcCode(error) === -32601) throw new Error("The public RPC refused an allowed account shape", { cause: error });
    return "executed-and-refused";
  }
}

function rpcCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error as { code?: unknown; baseError?: unknown };
  return typeof value.code === "number" ? value.code : rpcCode(value.baseError);
}
