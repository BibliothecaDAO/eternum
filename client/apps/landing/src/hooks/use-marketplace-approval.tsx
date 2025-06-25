import { marketplaceAddress } from "@/config";
import { SeasonPassAbi } from "@bibliothecadao/eternum";
import { useAccount, useContract, useReadContract, useSendTransaction } from "@starknet-react/core";
import { useEffect, useState } from "react";

export const useMarketplaceApproval = (collectionAddresses: string[]) => {
  const { address } = useAccount();
  const [isApprovingMarketplace, setIsApprovingMarketplace] = useState(false);
  const [approvedCollections, setApprovedCollections] = useState<Record<string, boolean>>({});

  // Create contract for first address
  const { contract: firstContract } = useContract({
    abi: SeasonPassAbi,
    address: collectionAddresses[0] as `0x${string}`,
  });

  // Create contract for second address if it exists
  const { contract: secondContract } = useContract({
    abi: SeasonPassAbi,
    address: collectionAddresses[1] as `0x${string}`,
  });

  // Create contract for third address if it exists
  const { contract: thirdContract } = useContract({
    abi: SeasonPassAbi,
    address: collectionAddresses[2] as `0x${string}`,
  });

  // Check approval status for all collections
  const { data: firstApproval } = useReadContract({
    abi: SeasonPassAbi,
    address: collectionAddresses[0] as `0x${string}`,
    functionName: "is_approved_for_all",
    args: [address as `0x${string}`, marketplaceAddress],
    refetchInterval: 10000,
    enabled: Boolean(collectionAddresses[0] && address && !approvedCollections[collectionAddresses[0]]),
  });

  const { data: secondApproval } = useReadContract({
    abi: SeasonPassAbi,
    address: collectionAddresses[1] as `0x${string}`,
    functionName: "is_approved_for_all",
    args: [address as `0x${string}`, marketplaceAddress],
    refetchInterval: 10000,
    enabled: Boolean(collectionAddresses[1] && address && !approvedCollections[collectionAddresses[1]]),
  });

  const { data: thirdApproval } = useReadContract({
    abi: SeasonPassAbi,
    address: collectionAddresses[2] as `0x${string}`,
    functionName: "is_approved_for_all",
    args: [address as `0x${string}`, marketplaceAddress],
    refetchInterval: 10000,
    enabled: Boolean(collectionAddresses[2] && address && !approvedCollections[collectionAddresses[2]]),
  });

  // Update approval status when queries return
  useEffect(() => {
    const updates: Record<string, boolean> = {};
    let hasUpdates = false;

    if (firstApproval && collectionAddresses[0] && !approvedCollections[collectionAddresses[0]]) {
      updates[collectionAddresses[0]] = true;
      hasUpdates = true;
    }
    if (secondApproval && collectionAddresses[1] && !approvedCollections[collectionAddresses[1]]) {
      updates[collectionAddresses[1]] = true;
      hasUpdates = true;
    }
    if (thirdApproval && collectionAddresses[2] && !approvedCollections[collectionAddresses[2]]) {
      updates[collectionAddresses[2]] = true;
      hasUpdates = true;
    }

    if (hasUpdates) {
      setApprovedCollections((prev) => ({
        ...prev,
        ...updates,
      }));
    }
  }, [firstApproval, secondApproval, thirdApproval, collectionAddresses]);

  // Prepare all approval calls
  const approvalCalls = [
    firstContract?.populate("set_approval_for_all", [marketplaceAddress, 1n]),
    secondContract?.populate("set_approval_for_all", [marketplaceAddress, 1n]),
    thirdContract?.populate("set_approval_for_all", [marketplaceAddress, 1n]),
  ].filter(Boolean);

  const { sendAsync } = useSendTransaction({
    calls: approvalCalls.length > 0 ? approvalCalls : undefined,
  });

  const handleApproveMarketplace = async () => {
    if (!address || approvalCalls.length === 0) return;

    setIsApprovingMarketplace(true);
    try {
      const data = await sendAsync();
      if (data?.transaction_hash) {
        // Mark all collections as approved after successful transaction
        const newApprovedCollections = collectionAddresses.reduce(
          (acc, addr) => ({
            ...acc,
            [addr]: true,
          }),
          {},
        );
        setApprovedCollections(newApprovedCollections);
      }
    } catch (error) {
      console.error("Failed to approve marketplace:", error);
      throw error;
    } finally {
      setIsApprovingMarketplace(false);
    }
  };

  const collectionApprovedForMarketplace = collectionAddresses.every((addr) => approvedCollections[addr]);

  return {
    collectionApprovedForMarketplace,
    isApprovingMarketplace,
    handleApproveMarketplace,
    approvedCollections,
  };
};
