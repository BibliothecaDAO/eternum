import { setup, type SetupResult } from "@bibliothecadao/dojo";
import { configManager } from "@bibliothecadao/eternum";
import type { Config } from "@bibliothecadao/types";

type SetupOptions = Parameters<typeof setup>[1];
type SetupCallbacks = Parameters<typeof setup>[2];
type DojoConfig = Parameters<typeof setup>[0];

export interface RunDojoSetupParams {
  dojoConfig: DojoConfig;
  setupOptions: SetupOptions;
  callbacks?: SetupCallbacks;
  initialSync: (setupResult: SetupResult) => Promise<void>;
  eternumConfig: Config;
}

export const runDojoSetup = async ({
  dojoConfig,
  setupOptions,
  callbacks,
  initialSync,
  eternumConfig,
}: RunDojoSetupParams): Promise<SetupResult> => {
  const setupResult = await setup({ ...dojoConfig }, setupOptions, callbacks);
  await initialSync(setupResult);
  configManager.setDojo(setupResult.components, eternumConfig);
  return setupResult;
};
