import { useAccount, useCall } from "@starknet-react/core";

import { LordsAbi } from "@bibliothecadao/eternum";

import { getLordsAddress } from "@/utils/addresses";
import { Abi } from "starknet";

export const useLords = ({ disabled }: { disabled?: boolean } = {}) => {
  const { account } = useAccount();

  const { data } = useCall({
    abi: LordsAbi as Abi,
    functionName: "balance_of",
    address: getLordsAddress() as `0x${string}`,
    args: [(account?.address as `0x${string}`) ?? "0"],
    watch: true,
    refetchInterval: 1000,
    enabled: !!account?.address && !disabled,
  });

  return {
    lordsBalance: (data as bigint) || BigInt(0),
  };
};
