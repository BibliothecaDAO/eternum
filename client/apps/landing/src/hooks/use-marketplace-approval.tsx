import { marketplaceAddress } from "@/config";
import { SeasonPassAbi } from "@bibliothecadao/eternum";
import { useAccount, useContract, useReadContract, useSendTransaction } from "@starknet-react/core";
import { useEffect, useState } from "react";

export const useMarketplaceApproval = (collectionAddress: string | undefined) => {
  const { address } = useAccount();
  const [isApprovingMarketplace, setIsApprovingMarketplace] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const { contract: collectionContract } = useContract({
    abi: SeasonPassAbi,
    address: collectionAddress as `0x${string}`,
  });

  const { data: collectionApprovedForMarketplace } = useReadContract({
    abi: SeasonPassAbi,
    address: collectionAddress as `0x${string}`,
    functionName: "is_approved_for_all",
    args: [address as `0x${string}`, marketplaceAddress],
    refetchInterval: 10000,
    enabled: Boolean(collectionAddress && address && !isApproved),
  });

  const { sendAsync } = useSendTransaction({
    calls:
      collectionContract && address
        ? [collectionContract.populate("set_approval_for_all", [marketplaceAddress, 1n])]
        : undefined,
  });

  useEffect(() => {
    console.log("collectionApprovedForMarketplace", collectionApprovedForMarketplace);
    if (collectionApprovedForMarketplace) {
      setIsApproved(true);
    }
  }, [collectionApprovedForMarketplace]);

  const handleApproveMarketplace = async () => {
    if (!collectionAddress || !address || !collectionContract) return;

    setIsApprovingMarketplace(true);
    try {
      const data = await sendAsync();
      console.log(data);
      if (data?.transaction_hash) {
        setIsApproved(true);
        setIsApprovingMarketplace(false);
      }
    } catch (error) {
      setIsApprovingMarketplace(false);
      console.error("Failed to approve marketplace:", error);
      throw error;
    }
  };

  return {
    collectionApprovedForMarketplace: isApproved,
    isApprovingMarketplace,
    handleApproveMarketplace,
  };
};
