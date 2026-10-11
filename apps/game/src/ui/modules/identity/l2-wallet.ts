import { mainnet, sepolia } from "@starknet-react/chains";

import { isL2Chain, L2_CHAIN } from "@/runtime/l2-rpc";

import { WrongNetworkError } from "./identity-failures";

/** The wallet connectors' one chain: the build's L2. */
export const L2_WALLET_CHAIN = L2_CHAIN.name === "SN_SEPOLIA" ? sepolia : mainnet;

/** A wallet connected on any chain but the build's L2 is refused before it signs anything. */
export const assertWalletOnL2 = (walletChainId: bigint | string): void => {
  if (!isL2Chain(walletChainId)) throw new WrongNetworkError();
};
