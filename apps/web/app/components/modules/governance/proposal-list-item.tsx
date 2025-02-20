import type { Proposal } from "@/gql/graphql";
import { Progress } from "@/components/ui/progress";
import { useStarkDisplayName } from "@/hooks/use-stark-name";
import { formatLockEndTime } from "@/utils/time";
import { shortenAddress } from "@/utils/utils";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

export const ProposalListItem = ({ proposal }: { proposal: Proposal }) => {
  const name = useStarkDisplayName(proposal.author.id as `0x${string}`);

  function getProposalId(proposal: Proposal) {
    const proposalId = proposal.proposal_id.toString();

    if (proposalId.startsWith("0x")) {
      return `#${proposalId.slice(2, 7)}`;
    }

    if ([46, 59].includes(proposalId.length)) {
      return `#${proposalId.slice(-5)}`;
    }

    return `#${proposalId}`;
  }

  return (
    <div className="mx-4 flex border-b py-[14px]">
      <div className="mr-4 w-0 flex-auto">
        <div className="flex space-x-2">
          <div className="my-1 items-center leading-6 md:flex md:min-w-0">
            <h4 className="my-0 text-lg font-semibold">
              {proposal.metadata?.title ?? `Proposal #${proposal.id}`}
            </h4>
          </div>
        </div>
        <div className="mr-4 inline">
          {getProposalId(proposal)} by{" "}
          {name || shortenAddress(proposal.author.id)}
        </div>
        <span className="mr-4">{proposal.vote_count} votes</span>
        {formatDistanceToNow(proposal.max_end * 1000, { addSuffix: true })}
      </div>

      <Progress
        value={
          (Number(proposal.scores_1) / Number(proposal.scores_total)) * 100
        }
        max={Number(proposal.scores_total)}
        className="w-30"
      />
    </div>
  );
};
