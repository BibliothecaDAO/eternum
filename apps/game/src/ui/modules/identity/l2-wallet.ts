import { mainnet } from "@starknet-react/chains";

import { isL2Chain, L2_CHAIN } from "@/runtime/l2-rpc";

import { WrongNetworkError } from "./identity-failures";

/** The wallet connectors' one chain: the build's L2, by the name its address book gives it. */
export const L2_WALLET_CHAIN = { SN_MAIN: mainnet }[L2_CHAIN.name];

/** A wallet connected on any chain but the build's L2 is refused before it signs anything. */
export const assertWalletOnL2 = (walletChainId: bigint | string): void => {
  if (!isL2Chain(walletChainId)) throw new WrongNetworkError();
};
