import { getManifest } from "../auth/embedded-data.js";
import { patchManifest } from "../world/discovery.js";
import type { AgentConfig } from "./config.js";

export function resolveBootstrapManifest(input: {
  chain: AgentConfig["chain"];
  worldAddress: string;
  contractsBySelector?: Record<string, string>;
  manifestOverride?: Record<string, unknown>;
}) {
  if (input.manifestOverride) {
    return input.manifestOverride;
  }

  const manifest = getManifest(input.chain);
  if (!input.contractsBySelector) {
    return manifest;
  }

  return patchManifest(manifest, input.worldAddress, input.contractsBySelector);
}
