import { createNpcSystemCalls } from "./npc/createSystemCalls";
import { EternumProvider } from "@bibliothecadao/eternum";

export type SystemCallFunctions = ReturnType<typeof createExtensionsSystemCalls>;

export function createExtensionsSystemCalls(provider: EternumProvider) {
  const npcSystemCalls = createNpcSystemCalls(provider);

  const extensionsSystemCalls = {
    ...npcSystemCalls,
  };

  return extensionsSystemCalls;
}
