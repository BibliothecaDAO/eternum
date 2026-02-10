import { initMetagame } from "metagame-sdk";
import type { ToriiClient } from "@dojoengine/torii-client";
import type { ProviderInterface } from "starknet";

type MetagameInitDependencies = {
  provider: ProviderInterface | null | undefined;
  toriiClient: ToriiClient | null | undefined;
  toriiUrl: string;
};

let hasInitializedMetagameClient = false;

/**
 * Metagame SDK hooks rely on the singleton client being initialized.
 * We initialize once in-app without wrapping the tree in a dedicated provider.
 */
export const ensureMetagameClientInitialized = ({
  provider,
  toriiClient,
  toriiUrl,
}: MetagameInitDependencies): boolean => {
  if (hasInitializedMetagameClient) {
    return true;
  }

  if (!provider || !toriiClient || !toriiUrl) {
    return false;
  }

  initMetagame({
    toriiUrl,
    provider,
    toriiClient,
  });
  hasInitializedMetagameClient = true;
  return true;
};

export const resetMetagameClientInitializationForTests = () => {
  hasInitializedMetagameClient = false;
};
