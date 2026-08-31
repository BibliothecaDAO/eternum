// Retired by A2 — appchain launches go through the registrar; kept for mainnet-era reference.
/**
 * Creates a game world through the appchain world factory.
 *
 *   bun deploy/appchain/scripts/factory-create-game.ts <game-name> [max_actions] [version]
 *
 * The factory deploys incrementally and keeps a cursor per (version, name), so
 * this calls `create_game` repeatedly until the cursor reports completion —
 * that's the documented pattern (contracts/l3/factory/README.md). Keep
 * max_actions modest: one huge batch can exceed katana's invoke_max_steps and
 * the transaction never gets accepted (it does not revert, it just hangs).
 */
import factoryManifest from "../../../contracts/l3/factory/manifest_appchain.json";
import { resolveAccountCredentials } from "../../../config/deployer/clean/shared/credentials";
import { Account, CallData, RpcProvider, shortString } from "starknet";

const RPC_URL = process.env.RPC_URL ?? "http://52.54.98.119";
const TORII_URL = process.env.TORII_URL ?? "http://52.54.98.119:8081";
const { accountAddress: ACCOUNT_ADDRESS, privateKey: PRIVATE_KEY } = resolveAccountCredentials({
  accountAddress: process.env.ACCOUNT_ADDRESS,
  privateKey: process.env.PRIVATE_KEY,
  context: "retired appchain factory game creation",
});

const FACTORY = (factoryManifest as { contracts: { tag: string; address: string }[] }).contracts.find(
  (c) => c.tag === "wf-factory",
)!.address;

const gameName = process.argv[2] ?? "blitzone";
const maxActions = process.argv[3] ?? "20";
const version = process.argv[4] ?? "140";
const MAX_BATCHES = 60;

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account({ provider, address: ACCOUNT_ADDRESS, signer: PRIVATE_KEY });

const sql = async (query: string): Promise<any[]> => {
  const res = await fetch(`${TORII_URL}/sql?query=${encodeURIComponent(query)}`);
  return res.ok ? res.json() : [];
};

const worldRow = async () => {
  const rows = await sql(`SELECT * FROM "wf-WorldDeployed" LIMIT 5`);
  return rows[0] ?? null;
};

console.log(`factory  ${FACTORY}`);
console.log(`game     ${gameName} (version ${version}, max_actions ${maxActions})\n`);

for (let batch = 1; batch <= MAX_BATCHES; batch++) {
  const calldata = CallData.compile([shortString.encodeShortString(gameName), maxActions, version, "0", "0"]);
  const { transaction_hash } = await account.execute({
    contractAddress: FACTORY,
    entrypoint: "create_game",
    calldata,
  });
  const receipt: any = await provider.waitForTransaction(transaction_hash);
  const status = receipt.execution_status ?? "UNKNOWN";
  console.log(`  batch ${batch}: ${status} ${transaction_hash} (${receipt.events?.length ?? 0} events)`);
  if (status === "REVERTED") {
    console.error(`revert: ${String(receipt.revert_reason).slice(0, 500)}`);
    process.exit(1);
  }

  const world = await worldRow();
  if (world) {
    console.log(`\n✓ world deployed: ${world.world_address ?? JSON.stringify(world).slice(0, 200)}`);
    process.exit(0);
  }
}

console.error(`\n✗ cursor did not complete after ${MAX_BATCHES} batches`);
process.exit(1);
