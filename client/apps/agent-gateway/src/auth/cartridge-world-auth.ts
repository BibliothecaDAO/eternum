import { resolveWorldAuthContext } from "@bibliothecadao/agent-runtime";
import type { LaunchMyAgentRequest } from "@bibliothecadao/types";

export async function resolveGatewayWorldAuthContext(
  payload: Pick<LaunchMyAgentRequest, "worldId" | "worldName" | "chain" | "rpcUrl" | "toriiBaseUrl">,
) {
  return resolveWorldAuthContext({
    worldId: payload.worldId,
    worldName: payload.worldName,
    chain: payload.chain,
    rpcUrl: payload.rpcUrl,
    toriiBaseUrl: payload.toriiBaseUrl,
    cartridgeApiBase: process.env.CARTRIDGE_API_BASE,
  });
}
