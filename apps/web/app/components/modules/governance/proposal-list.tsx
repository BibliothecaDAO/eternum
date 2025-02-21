import { getProposalsQueryOptions } from "@/lib/getProposals";
import { getUserVotesQueryOptions } from "@/lib/getUserVotes";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

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
      spaceIds: [
        "0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62",
      ],
      limit,
      skip: 0,
      current: 1,
      searchQuery: "",
    }),
  );
  const proposals = proposalsQuery.proposals;

  const { data: userVotesQuery } = useQuery(
    getUserVotesQueryOptions({
      spaceIds: [
        "0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62",
      ],
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
          return vote?.proposal === Number(proposal?.id?.split("/")?.[1]);
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
