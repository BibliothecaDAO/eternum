import { assertPublicRpcBoundary } from "./public-rpc-check";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { Account, BlockTag, ec, RpcProvider } from "starknet";
import { approveBotDevice, DeviceSigner, deviceKeyOf } from "../../../packages/core/src/account/realms-account";
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
const { operatorAccountAddress: operator, operatorLabel } = JSON.parse(
  readFileSync(`${directory}/gameplay-contracts.json`, "utf8"),
);
console.log(JSON.stringify(await assertPublicRpcBoundary(url, { ...manifest.shard, operator })));
const provider = new RpcProvider({ nodeUrl: url, blockIdentifier: BlockTag.PRE_CONFIRMED });
const device = deviceKeyOf(`0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")}`);
const smoke = mkdtempSync(`${directory}/rpc-smoke-`);
writeFileSync(`${smoke}/device.json`, JSON.stringify(device), { mode: 0o600, flag: "wx" });
const operatorToken = process.env.OPERATOR_TOKEN;
if (!operatorToken || !operatorLabel) {
  throw new Error(
    "The smoke's device changes on the operator are approved through the operator route: it needs OPERATOR_TOKEN and " +
      "an operator enrolled as a bot. A community shard checks its boundary with inspect-shard-roles --public-rpc.",
  );
}
const approve = approveBotDevice({ url: env.IDENTITY_URL, operatorToken }, operatorLabel);
async function approval(action: "ADD" | "REVOKE") {
  const [counter] = await provider.callContract(
    { contractAddress: operator, entrypoint: "device_change_counter", calldata: [] },
    BlockTag.PRE_CONFIRMED,
  );
  return approve({
    chainId: manifest.shard.chainId,
    account: operator,
    action,
    deviceKey: device.publicKey,
    counter: Number(BigInt(counter)) + 1,
  });
}
const joining = new Account({
  provider,
  address: operator,
  signer: new DeviceSigner(device, await approval("ADD")),
  cairoVersion: "1",
});
const join = await joining.execute(
  { contractAddress: operator, entrypoint: "is_device", calldata: [device.publicKey] },
  { tip: 0 },
);
await provider.waitForTransaction(join.transaction_hash, { retryInterval: 250 });
const [added] = await provider.callContract(
  { contractAddress: operator, entrypoint: "is_device", calldata: [device.publicKey] },
  BlockTag.PRE_CONFIRMED,
);
if (BigInt(added) !== 1n) throw new Error("Device was not joined");
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
const revoke = await owner.execute(
  {
    contractAddress: operator,
    entrypoint: "revoke_device",
    calldata: [device.publicKey, ...(await approval("REVOKE"))],
  },
  { tip: 0 },
);
await provider.waitForTransaction(revoke.transaction_hash, { retryInterval: 250 });
const [removed] = await provider.callContract(
  { contractAddress: operator, entrypoint: "is_device", calldata: [device.publicKey] },
  BlockTag.PRE_CONFIRMED,
);
if (BigInt(removed) !== 0n) throw new Error("Device was not revoked");
console.log(
  JSON.stringify({
    chainId: manifest.shard.chainId,
    acceptedOperatorInvoke: operatorInvoke.transaction_hash,
    acceptedJoin: join.transaction_hash,
    acceptedRevoke: revoke.transaction_hash,
    deviceRevoked: true,
  }),
);
