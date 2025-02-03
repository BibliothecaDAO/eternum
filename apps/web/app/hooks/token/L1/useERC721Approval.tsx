import { useEffect } from "react";
import { SUPPORTED_L1_CHAIN_ID } from "@/utils/utils";
import { erc721Abi } from "viem";
import {
  useAccount,
  useBlockNumber,
  useReadContract,
  useWaitForTransactionReceipt,
} from "wagmi";

import {
  CollectionAddresses,
  REALMS_BRIDGE_ADDRESS,
} from "@realms-world/constants";

import { useERC721SetApprovalForAll } from "./useERC721SetApprovalForAll";

export default function useERC721Approval() {
  const { address } = useAccount();
  const { writeAsync, data, isPending } = useERC721SetApprovalForAll({
    onSuccess: (data) => console.log("approved" + data),
  });
  const { data: isApprovedForAll, refetch } = useReadContract({
    abi: erc721Abi,
    address: CollectionAddresses.realms[SUPPORTED_L1_CHAIN_ID] as `0x${string}`,
    args: address && [
      address,
      REALMS_BRIDGE_ADDRESS[SUPPORTED_L1_CHAIN_ID] as `0x${string}`,
    ],
    functionName: "isApprovedForAll",
    query: {
      enabled: !!address,
    },
  });

  const { data: blockNumber } = useBlockNumber({ watch: true });

  useEffect(() => {
    if (address && !isApprovedForAll) {
      console.log("refetcjomgs" + isApprovedForAll);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      refetch();
    }
  }, [blockNumber, refetch, address, isApprovedForAll]);

  const approveForAll = async () =>
    await writeAsync({
      contractAddress: CollectionAddresses.realms[
        SUPPORTED_L1_CHAIN_ID
      ] as `0x${string}`,
      operator: REALMS_BRIDGE_ADDRESS[SUPPORTED_L1_CHAIN_ID] as `0x${string}`,
    });

  const { isLoading: approveForAllLoading } = useWaitForTransactionReceipt({
    hash: data,
  });

  return {
    isApprovedForAll,
    approveForAll,
    approveForAllLoading: approveForAllLoading && data !== undefined,
    isPending,
  };
}
