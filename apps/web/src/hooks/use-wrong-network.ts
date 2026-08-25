import { useEffect, useState } from "react";
import { mainnet, sepolia } from "@starknet-start/chains";
import { useAccount } from "@starknet-start/react";
import { env } from "env";

const useIsWrongNetwork = () => {
  const { address, chainId } = useAccount();
  const [isWrongNetwork, setIsWrongNetwork] = useState<boolean>(false);

  function bigintToStringHex(element: bigint | undefined): string {
    if (element === undefined) return "";

    const hex = element.toString(16);
    return element < 0 ? `-0x${hex.slice(1)}` : `0x${hex}`;
  }

  useEffect(() => {
    if (!address) {
      setIsWrongNetwork(false);
      return;
    }
    setIsWrongNetwork(
      env.VITE_PUBLIC_CHAIN === "sepolia"
        ? bigintToStringHex(chainId) === bigintToStringHex(mainnet.id)
        : bigintToStringHex(chainId) === bigintToStringHex(sepolia.id),
    );
  }, [address, chainId]);

  return {
    isWrongNetwork,
    setIsWrongNetwork,
  };
};

export default useIsWrongNetwork;
