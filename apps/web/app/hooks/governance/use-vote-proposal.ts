import type { Proposal } from "@/gql/graphql";
import type { Choice } from "@/types/snapshot";
import { useCallback } from "react";
import { SnapshotSpace } from "@/abi/L2/SnapshotSpace";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import {
  useAccount,
  useContract,
  useSendTransaction,
} from "@starknet-react/core";
import { CairoCustomEnum } from "starknet";

import { SnapshotSpaceAddresses } from "@realms-world/constants";

export function getChoiceEnum(choice: 0 | 1 | 2) {
  return new CairoCustomEnum({
    Against: choice === 0 ? 0 : undefined,
    For: choice === 1 ? 1 : undefined,
    Abstain: choice === 2 ? 2 : undefined,
  });
}
export function getUserAddressEnum(
  type: "ETHEREUM" | "STARKNET" | "CUSTOM",
  address: string,
) {
  return new CairoCustomEnum({
    Starknet: type === "STARKNET" ? address : undefined,
    Ethereum: type === "ETHEREUM" ? address : undefined,
    Custom: type === "CUSTOM" ? address : undefined,
  });
}

export function useVoteProposal(proposal: Proposal) {
  const { address } = useAccount();

  const { contract } = useContract({
    abi: SnapshotSpace,
    address: SnapshotSpaceAddresses[SUPPORTED_L2_CHAIN_ID] as `0x${string}`,
  });

  // Initialize with an empty calls array
  const { sendAsync, data: txHash, ...txState } = useSendTransaction({});

  const vote = useCallback(
    async (choice: Choice, reason: string) => {
      try {
        return await sendAsync(
          contract && address && choice
            ? [
                contract.populate("vote", [
                  getUserAddressEnum("STARKNET", address as string),
                  proposal.proposal_id,
                  getChoiceEnum(choice),
                  [{ index: 0, params: [] }],
                  [],
                ]),
              ]
            : undefined,
        );
        // You'll need to adjust these parameters based on your contract's requirements
      } catch (error) {
        console.error("Error voting on proposal:", error);
        return null;
      }
    },
    [contract, address, sendAsync],
  );

  return {
    vote,
    txHash,
    ...txState,
  };
}
