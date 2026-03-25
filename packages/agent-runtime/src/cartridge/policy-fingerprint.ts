import { createHash } from "node:crypto";

import type { CartridgeWorldAuthContext } from "../types";

export function computeCartridgePolicyFingerprint(input: {
  chain: CartridgeWorldAuthContext["chain"];
  chainId: string;
  rpcUrl: string;
  worldAddress: string;
  policies: Record<string, unknown>;
}): string {
  const normalized = JSON.stringify({
    chain: input.chain,
    chainId: input.chainId,
    rpcUrl: input.rpcUrl,
    worldAddress: input.worldAddress,
    policies: input.policies,
  });

  return createHash("sha256").update(normalized).digest("hex");
}
