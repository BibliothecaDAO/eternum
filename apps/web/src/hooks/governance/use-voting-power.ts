import { RealmsABI } from "@/abi/L2/Realms";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useAccount, useReadContract } from "@starknet-react/core";

import { CollectionAddresses } from "@realms-world/constants";

export const useVotingPower = () => {
  const { address } = useAccount();

  const l2RealmsAddress = CollectionAddresses.realms[
    SUPPORTED_L2_CHAIN_ID
  ] as `0x${string}`;

  return useReadContract({
    abi: RealmsABI,
    address: l2RealmsAddress,
    args: address ? [address] : undefined,
    functionName: "get_votes",
    watch: true,
  });
};
