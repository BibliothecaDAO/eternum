import { abi } from "@/abi/Lords";
import { lordsAddress } from "@/config";
import { useAccount, useCall } from "@starknet-react/core";
import { Abi } from "starknet";

export const useLords = ({ disabled }: { disabled?: boolean } = {}) => {
  const { account } = useAccount();

  const { data } = useCall({
    abi: abi as Abi,
    functionName: "balance_of",
    address: lordsAddress as `0x${string}`,
    args: [(account?.address as `0x${string}`) ?? "0"],
    watch: true,
    refetchInterval: 1000,
    enabled: !!account?.address && !disabled,
  });

  return {
    lordsBalance: (data as bigint) || BigInt(0),
  };
};
