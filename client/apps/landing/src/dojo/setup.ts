import { ClientConfigManager, createClientComponents } from "@bibliothecadao/eternum";
import { DojoConfig } from "@dojoengine/core";
import { createSystemCalls } from "./createSystemCalls";
import { setupNetwork } from "./setupNetwork";
import { ETERNUM_CONFIG } from "../utils/config";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);

  const configManager = ClientConfigManager.instance();

  const eternumConfig = await ETERNUM_CONFIG();
  configManager.setDojo(components, eternumConfig);

  return {
    network,
    components,
    systemCalls,
  };
}
