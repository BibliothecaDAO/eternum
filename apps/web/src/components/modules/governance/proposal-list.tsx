import { getProposalsQueryOptions } from "@/lib/snapshot/getProposals";
import { isMatchingProposalVote } from "@/lib/snapshot/proposal-id";
import { getUserVotesQueryOptions } from "@/lib/snapshot/getUserVotes";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { SnapshotSpaceAddresses } from "@realms-world/constants";

import { ProposalListItem } from "./proposal-list-item";

export function ProposalList({
  limit = 5,
  delegateId,
}: {
  limit?: number;
  delegateId?: string;
}) {
  const { data: proposalsQuery } = useSuspenseQuery(
    getProposalsQueryOptions({
      spaceIds: [SnapshotSpaceAddresses[SUPPORTED_L2_CHAIN_ID] as string],
      limit,
      skip: 0,
      current: 1,
      searchQuery: "",
    }),
  );
  const proposals = proposalsQuery.proposals;

  const { data: userVotesQuery } = useQuery(
    getUserVotesQueryOptions({
      spaceIds: [SnapshotSpaceAddresses[SUPPORTED_L2_CHAIN_ID] as string],
      limit,
      skip: 0,
      voter: delegateId ?? "",
    }),
  );
  const userVotes = userVotesQuery?.votes;

  return (
    <div className="flex flex-col">
      {proposals?.map((proposal) => {
        const matchingVote = userVotes?.find((vote) => {
          return isMatchingProposalVote(vote?.proposal, proposal?.proposal_id);
        });
        return (
          <ProposalListItem
            key={proposal.id}
            proposal={proposal}
            voteChoice={
              !delegateId || BigInt(delegateId) === 0n
                ? 4
                : matchingVote?.choice
            }
          />
        );
      })}
    </div>
  );
}
