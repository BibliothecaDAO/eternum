/**
 * The Starknet mainnet RPCs an environment's L2 RPC may be, one list for setup, the client build and the Workers: the
 * team's Alchemy app (its key in the path) and Cartridge's public mainnet endpoint. Every other Cartridge host stays
 * refused (endpoints.ts). Which chain answers is still checked by chain id where the URL is used.
 */
const MAINNET_L2_RPCS = [
  {
    name: "Alchemy",
    host: "starknet-mainnet.g.alchemy.com",
    path: (path: string) => path !== "/",
  },
  {
    name: "Cartridge",
    host: "api.cartridge.gg",
    path: (path: string) => path === "/x/starknet/mainnet",
  },
] as const;

/** How a refusal names the accepted RPCs. */
export const MAINNET_L2_RPC_NAMES =
  "Alchemy (starknet-mainnet.g.alchemy.com) or Cartridge (api.cartridge.gg/x/starknet/mainnet)";

/** Whether a URL is one of the accepted Starknet mainnet RPCs, over HTTPS with nothing but its path. */
export const isMainnetL2Rpc = (value: string | undefined): boolean => {
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    !url.port &&
    !url.username &&
    !url.password &&
    !url.hash &&
    !url.search &&
    MAINNET_L2_RPCS.some(
      (rpc) => url.hostname === rpc.host && rpc.path(url.pathname),
    )
  );
};
