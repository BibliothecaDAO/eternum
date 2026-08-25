// Retired by A2 — appchain launches go through the registrar; kept for mainnet-era reference.
/**
 * Registers a FactoryConfig version on the appchain world factory so
 * `create_game` can deploy game worlds.
 *
 *   bun deploy/appchain/scripts/factory-config.ts register [version]
 *   bun deploy/appchain/scripts/factory-config.ts status [version]
 *
 * The factory stores its config on-chain keyed by version (see
 * contracts/factory/README.md). Registration is 5 admin calls built from the
 * game manifest's class hashes — the same payload the client's factory
 * developer UI submits, via the shared builder so the two cannot drift.
 */
import { buildFactoryConfigCalldataParts } from "../../../apps/game/src/ui/features/factory/shared/factory-config-calldata";
import { resolveAccountCredentials } from "../../../config/deployer/clean/shared/credentials";
import gameManifest from "../../../contracts/game/manifest_appchain_blitz.json";
import factoryManifest from "../../../contracts/factory/manifest_appchain.json";
import { Account, CallData, RpcProvider } from "starknet";

const RPC_URL = process.env.RPC_URL ?? "http://52.54.98.119";
const TORII_URL = process.env.TORII_URL ?? "http://52.54.98.119:8081";
const { accountAddress: ACCOUNT_ADDRESS, privateKey: PRIVATE_KEY } = resolveAccountCredentials({
  accountAddress: process.env.ACCOUNT_ADDRESS,
  privateKey: process.env.PRIVATE_KEY,
  context: "retired appchain factory config",
});
const NAMESPACE = "s1_eternum";

const FACTORY = (factoryManifest as { contracts: { tag: string; address: string }[] }).contracts.find(
  (c) => c.tag === "wf-factory",
)?.address;
if (!FACTORY) throw new Error("wf-factory not found in contracts/factory/manifest_appchain.json");

const provider = new RpcProvider({ nodeUrl: RPC_URL });
const account = new Account({ provider, address: ACCOUNT_ADDRESS, signer: PRIVATE_KEY });

const send = async (label: string, entrypoint: string, calldata: unknown[]) => {
  const { transaction_hash } = await account.execute({
    contractAddress: FACTORY,
    entrypoint,
    calldata: CallData.compile(calldata as never),
  });
  const receipt: any = await provider.waitForTransaction(transaction_hash);
  const status = receipt.execution_status ?? "UNKNOWN";
  console.log(`  ${status === "REVERTED" ? "✗" : "✓"} ${label} ${transaction_hash} ${status}`);
  if (status === "REVERTED") throw new Error(receipt.revert_reason ?? "reverted");
};

const version = process.argv[3] ?? "1";

async function register() {
  const manifest = gameManifest as any;
  console.log(`factory ${FACTORY}`);
  console.log(
    `registering config version "${version}": ${manifest.contracts.length} contracts, ` +
      `${manifest.models.length} models, ${manifest.events.length} events, ${manifest.libraries?.length ?? 0} libraries\n`,
  );

  const parts = buildFactoryConfigCalldataParts(manifest, version, NAMESPACE, true);
  await send("set_factory_config", "set_factory_config", parts.base);
  await send("set_factory_config_contracts", "set_factory_config_contracts", parts.contracts);
  await send("set_factory_config_models", "set_factory_config_models", parts.models);
  await send("set_factory_config_events", "set_factory_config_events", parts.events);
  await send("set_factory_config_libraries", "set_factory_config_libraries", parts.libraries);
  console.log("\nconfig registered — create_game can now deploy worlds with this version");
}

async function status() {
  const res = await fetch(
    `${TORII_URL}/sql?query=${encodeURIComponent('SELECT * FROM "wf-FactoryConfig" LIMIT 5')}`,
  );
  const rows = await res.json();
  console.log(`factory ${FACTORY}`);
  console.log("registered config versions:", JSON.stringify(rows, null, 2).slice(0, 800));
}

const command = process.argv[2] ?? "status";
(command === "register" ? register() : status()).catch((e) => {
  console.error(`\n✗ ${e.message ?? e}`);
  process.exit(1);
});
