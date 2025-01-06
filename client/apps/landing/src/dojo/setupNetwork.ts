import { EternumProvider } from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { defineContractComponents } from "./contractComponents";
import { world } from "./world";

import { BurnerManager } from "@dojoengine/create-burner";
import * as torii from "@dojoengine/torii-client";
import { Account } from "starknet";

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork({ ...config }: DojoConfig) {
  const provider = new EternumProvider(config.manifest, config.rpcUrl);

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
  await burnerManager.init();

  try {
    if (import.meta.env.VITE_PUBLIC_CHAIN === "local") {
      if (burnerManager.list().length === 0) {
        await burnerManager.create();
      }
    } else {
      await burnerManager.clear();
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
