import { EternumProvider } from "@bibliothecadao/provider";
import { getGameManifest } from "@contracts";
import { Account } from "starknet";
import { confirmNonLocalDeployment } from "../utils/confirmation";
import { logNetwork, saveConfigJsonFromConfigTsFile, type NetworkType } from "../utils/environment";
import { type Chain } from "../utils/utils";
import { GameConfigDeployer, nodeReadConfig } from "./config";
import { withBatching } from "./tx-batcher";

const {
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_CHAIN,
  VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
} = process.env;

// =============== SETUP ETERNUM CONFIG ===============

// prompt user to confirm non-local deployment
confirmNonLocalDeployment(VITE_PUBLIC_CHAIN!);

const manifest = await getGameManifest(VITE_PUBLIC_CHAIN! as Chain);
const provider = new EternumProvider(manifest, VITE_PUBLIC_NODE_URL, VITE_PUBLIC_VRF_PROVIDER_ADDRESS);

const options = {
  provider: provider.provider,
  address: VITE_PUBLIC_MASTER_ADDRESS!,
  signer: VITE_PUBLIC_MASTER_PRIVATE_KEY!,
};
const account = new Account(options);

await saveConfigJsonFromConfigTsFile(VITE_PUBLIC_CHAIN! as NetworkType);
const configuration = await nodeReadConfig(VITE_PUBLIC_CHAIN! as Chain);
export const config = new GameConfigDeployer(configuration, VITE_PUBLIC_CHAIN! as NetworkType);

// Deploy configurations
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);
// Optional batching: set CONFIG_BATCH=1 to queue all config calls into a single multicall.
// Optionally, CONFIG_IMMEDIATE_ENTRYPOINTS can be a comma-separated list of entrypoints that should execute immediately
// even in batch mode, e.g. "set_world_config,set_blitz_previous_game".
const BATCH = process.env.CONFIG_BATCH === "1" || process.env.CONFIG_BATCH === "true";
const IMMEDIATE = (process.env.CONFIG_IMMEDIATE_ENTRYPOINTS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (BATCH) {
  // Skip inter-call sleeps when batching
  config.skipSleeps = true;
  const flushReceipt = await withBatching(
    provider,
    account,
    async () => {
      await config.setupAll(account, provider);
    },
    { immediateEntrypoints: IMMEDIATE, label: "config" },
  );
  console.log("Batched multicall submitted:", (flushReceipt as any)?.transaction_hash ?? "<unknown>");
} else {
  await config.setupAll(account, provider);
}
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);
