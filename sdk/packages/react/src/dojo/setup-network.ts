import { defineContractComponents, EternumProvider } from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { BurnerManager } from "@dojoengine/create-burner";
import * as torii from "@dojoengine/torii-client";
import { Account } from "starknet";
import { world } from "./world";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork(
  config: DojoConfig,
  env: {
    viteVrfProviderAddress: string;
    vitePublicDev: boolean;
  },
) {
  const provider = new EternumProvider(config.manifest, config.rpcUrl, env.viteVrfProviderAddress);

  const toriiClient = await torii.createClient({
    rpcUrl: config.rpcUrl,
    toriiUrl: config.toriiUrl,
    relayUrl: config.relayUrl,
    worldAddress: config.manifest.world.address || "",
  });

  const burnerManager = new BurnerManager({
    masterAccount: new Account(provider.provider, config.masterAddress, config.masterPrivateKey),
    accountClassHash: config.accountClassHash,
    rpcProvider: provider.provider,
    feeTokenAddress: config.feeTokenAddress,
  });

  try {
    await burnerManager.init();
    if (env.vitePublicDev === true && burnerManager.list().length === 0) {
      await burnerManager.create();
    }
  } catch (e) {
    console.error(e);
  }

  return {
    toriiClient,
    contractComponents: defineContractComponents(world),
    provider,
    world,
    burnerManager,
  };
}
