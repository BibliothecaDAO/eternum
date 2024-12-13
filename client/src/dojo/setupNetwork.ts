import { EternumProvider } from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { defineContractComponents } from "./contractComponents";
import { world } from "./world";

import { BurnerManager } from "@dojoengine/create-burner";
import * as torii from "@dojoengine/torii-client";
import { Account } from "starknet";

import { env } from "./../../env";
const { VITE_VRF_PROVIDER_ADDRESS, VITE_PUBLIC_DEV } = env;

export type SetupNetworkResult = Awaited<ReturnType<typeof setupNetwork>>;

export async function setupNetwork({ ...config }: DojoConfig) {
  const provider = new EternumProvider(config.manifest, config.rpcUrl, VITE_VRF_PROVIDER_ADDRESS);

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
    if (VITE_PUBLIC_DEV === true && burnerManager.list().length === 0) {
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
