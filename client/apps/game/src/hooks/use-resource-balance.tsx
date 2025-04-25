import { LordsAbi } from "@bibliothecadao/eternum";
import { useAccount, useCall } from "@starknet-react/core";
import { Abi } from "starknet";

export const useResourceBalance = ({ 
  resourceAddress, 
  disabled 
}: { 
  resourceAddress: string | null; 
  disabled?: boolean 
}) => {
  const { account } = useAccount();

  const { data } = useCall({
    abi: LordsAbi as Abi, // Using LordsAbi as the interface is the same for all ERC20 tokens
    functionName: "balance_of",
    address: resourceAddress as `0x${string}`,
    args: [(account?.address as `0x${string}`) ?? "0"],
    watch: true,
    refetchInterval: 1000,
    enabled: !!account?.address && !!resourceAddress && !disabled,
  });

  return {
    balance: (data as bigint) || BigInt(0),
  };
}; 