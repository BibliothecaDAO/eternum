import type { Proposal } from "@/gql/graphql";
import { Progress } from "@/components/ui/progress";
import { useStarkDisplayName } from "@/hooks/use-stark-name";
import { shortenAddress } from "@/utils/utils";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle } from "lucide-react";

import { ProposalVoteAction } from "./proposal-vote-action";

export const ProposalListItem = ({
  proposal,
  voteChoice,
}: {
  proposal: Proposal;
  voteChoice: number;
}) => {
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

  const isActive = proposal.max_end * 1000 > Date.now();

  return (
    <div className="flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
      <Link
        to={`/proposal/$id`}
        params={{ id: proposal.proposal_id.toString() }}
        className="min-w-0 flex-1"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h4 className="line-clamp-2 text-lg font-semibold">
              {proposal.metadata?.title ?? `Proposal #${proposal.id}`}
            </h4>
            <div className="text-muted-foreground text-sm">
              {getProposalId(proposal)} by{" "}
              {name || shortenAddress(proposal.author.id)}
            </div>
          </div>

          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{proposal.vote_count} voters</span>
            <span>{proposal.scores_total} votes</span>
            <span>
              {formatDistanceToNow(proposal.max_end * 1000)}{" "}
              {isActive ? "left" : "ago"}
            </span>
          </div>
        </div>
      </Link>

      {isActive ? (
        <div className="flex-shrink-0">
          <ProposalVoteAction proposal={proposal} />
        </div>
      ) : (
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          <Progress
            value={
              (Number(proposal.scores_1) / Number(proposal.scores_total)) * 100
            }
            max={Number(proposal.scores_total)}
            className="w-full bg-red-500/60 sm:w-32"
            indicatorColor="bg-green-500"
          />

          <div className="text-muted-foreground text-sm">
            <div className="flex items-center gap-2">
              {voteChoice == 4 ? (
                ""
              ) : voteChoice === 1 ? (
                <>
                  Delegate: <CheckCircle2 className="h-4 w-4" />
                  For
                </>
              ) : voteChoice === 3 ? (
                <>
                  Delegate: <XCircle className="h-4 w-4" />
                  Against
                </>
              ) : (
                "Delegate did not vote"
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
