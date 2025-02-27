import type { Proposal } from "@/gql/graphql";
import type { Choice } from "@/types/snapshot";
import { useCallback, useMemo, useState } from "react";
import { SnapshotSpace } from "@/abi/L2/SnapshotSpace";
import { StarkTxAuthenticator } from "@/abi/L2/StarkTxAuthenticator";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import {
  useAccount,
  useContract,
  useSendTransaction,
} from "@starknet-react/core";
import { CairoCustomEnum, Call, shortString } from "starknet";

import { SnapshotSpaceAddresses } from "@realms-world/constants";

import { useIPFSPin } from "../use-ipfs-pin";

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
  const [selectedChoice, setSelectedChoice] = useState<Choice | null>(null);
  const { pinToIPFS, isLoading, error, result } = useIPFSPin();

  const { contract } = useContract({
    abi: StarkTxAuthenticator,
    address: proposal.space.authenticators[0] as `0x${string}`,
  });

  // Initialize with an empty calls array
  const { sendAsync, data: txHash, ...txState } = useSendTransaction({});

  const vote = useCallback(
    async (reason: string) => {
      if (!contract || !selectedChoice) return null;
      let pinned: { cid: string; provider: string } | null = null;
      if (reason) pinned = await pinToIPFS({ reason });

      try {
        return await sendAsync([
          contract.populate("authenticate_vote", [
            proposal.space.id,
            address as string,
            proposal.proposal_id,
            getChoiceEnum(selectedChoice),
            [{ index: 0, params: [] }], // ERC20Votes strategy
            pinned ? shortString.splitLongString(`ipfs://${pinned.cid}`) : [],
          ]),
        ]);
        // You'll need to adjust these parameters based on your contract's requirements
      } catch (error) {
        console.error("Error voting on proposal:", error);
        return null;
      }
    },
    [
      contract,
      selectedChoice,
      pinToIPFS,
      sendAsync,
      proposal.space.id,
      proposal.proposal_id,
      address,
    ],
  );

  return {
    selectedChoice,
    setSelectedChoice,
    vote,
    txHash,
    ...txState,
  };
}
