import { lordsAddress } from "@/config";
import { useAccount, useCall } from "@starknet-react/core";

import { abi } from "@/abi/Lords";

import { useContract } from "@starknet-react/core";
import { Abi } from "starknet";

export const useLords = () => {
  const { account } = useAccount();

  const { data } = useCall({
    abi: abi as Abi,
    functionName: "balance_of",
    address: lordsAddress,
    args: [(account?.address as `0x${string}`) ?? "0"],
    watch: true,
    refetchInterval: 1000,
  });

  const { contract } = useContract({
    abi: abi as Abi,
    address: lordsAddress,
  });

  return {
    lordsBalance: data,
    // transferLords,
  };
};
