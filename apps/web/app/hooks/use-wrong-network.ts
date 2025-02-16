import { useEffect, useState } from "react";
import { mainnet, sepolia } from "@starknet-react/chains";
import { useAccount, useNetwork } from "@starknet-react/core";
import { env } from "env";

const useIsWrongNetwork = () => {
  const { chain } = useNetwork();
  const { account } = useAccount();
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
    console.log(bigintToStringHex(chain.id), bigintToStringHex(sepolia.id));
    setIsWrongNetwork(
      env.VITE_PUBLIC_CHAIN === "sepolia"
        ? bigintToStringHex(chain.id) === bigintToStringHex(mainnet.id)
        : bigintToStringHex(chain.id) === bigintToStringHex(sepolia.id),
    );
  }, [account, chain]);

  return {
    isWrongNetwork,
    setIsWrongNetwork,
  };
};

export default useIsWrongNetwork;
