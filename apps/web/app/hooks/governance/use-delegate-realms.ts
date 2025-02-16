import { RealmsABI } from "@/abi/L2/Realms";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useContract, useSendTransaction } from "@starknet-react/core";

import { CollectionAddresses } from "@realms-world/constants";

export const useDelegateRealms = ({ delegatee }: { delegatee?: string }) => {
  const l2RealmsAddress = CollectionAddresses.realms[
    SUPPORTED_L2_CHAIN_ID
  ] as `0x${string}`;

  const { contract } = useContract({
    abi: RealmsABI,
    address: l2RealmsAddress,
  });

  const {
    sendAsync,
    data: withdrawHash,
    ...writeReturn
  } = useSendTransaction({
    calls:
      contract && delegatee
        ? [contract.populate("delegate", [delegatee])]
        : undefined,
  });

  return {
    sendAsync,
    withdrawHash,
    ...writeReturn,
  };
};
