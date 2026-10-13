import { validateInputs } from "./dates";
import { RpcProvider } from "starknet";
import { PrivateStore } from "./private-store";
import { environments, root, type Inputs } from "./settings";
import { deploymentEnvironment, reportFailure } from "./deploy";
import { seasonSteps, type Season } from "./season-steps";
import { runSteps } from "./run";
import { PublicError } from "./errors";
import type { Keys } from "./chain";
import { existingAssets, type Assets } from "./ledger";
import type { Secrets } from "./platform";

export async function main() {
  const [environment, directory, ...extra] = process.argv.slice(2);
  if (!directory || extra.length)
    throw new PublicError("Usage: pnpm run season <dev|production> /absolute/private-directory");
  const target = deploymentEnvironment(environment);
  const store = new PrivateStore(directory, root, true);
  const inputs = store.read<Inputs>("inputs.json");
  if (!inputs) throw new PublicError("Run setup before opening a season");
  validateInputs(inputs, environments[target]);
  const assets = existingAssets(environments[target]);
  if (!assets.ledger || !assets.lords || !assets.mmr || !assets.chests || !assets.cosmetics)
    throw new PublicError("Run setup to publish the environment address book before opening a season");
  const context: Season = {
    environment: target,
    target: environments[target],
    store,
    apply: true,
    inputs,
    keys: store.read<Keys>("keys.json"),
    secrets: store.read<Secrets>("secrets.json"),
    assets: assets as Assets,
    provider: new RpcProvider({ nodeUrl: inputs.rpc, blockIdentifier: "latest" }),
    output: console.log,
  };
  const unlock = store.lock();
  try {
    await runSteps(seasonSteps(context), true, context.output);
  } finally {
    unlock();
  }
}

if (import.meta.main) main().catch(reportFailure);
