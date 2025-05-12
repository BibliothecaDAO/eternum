import { useEffect, useState } from "react";
import { mainnet, sepolia } from "@starknet-react/chains";
import { useAccount, useNetwork } from "@starknet-react/core";
import { env } from "env";
import { Chain } from "starknet"

const useIsWrongNetwork = () => {
  const { chain } = useNetwork();
  const { account, chainId } = useAccount();
  const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);

  function bigintToStringHex(element: bigint | undefined): string {
    if (element === undefined) return "";

    const hex = element.toString(16);
    return element < 0 ? `-0x${hex.slice(1)}` : `0x${hex}`;
  }

  useEffect(() => {
    if (!account) {
      setIsWrongNetwork(false);
      return;
    }
    setIsWrongNetwork(
      env.VITE_PUBLIC_CHAIN === "sepolia"
        ? bigintToStringHex(chainId) === bigintToStringHex(mainnet.id)
        : bigintToStringHex(chainId) === bigintToStringHex(sepolia.id),
    );
  }, [account, chainId]);

  return {
    isWrongNetwork,
    setIsWrongNetwork,
  };
};

export default useIsWrongNetwork;
