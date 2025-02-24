import type { Proposal } from "@/gql/graphql";
import { Progress } from "@/components/ui/progress";
import { useStarkDisplayName } from "@/hooks/use-stark-name";
import { formatLockEndTime } from "@/utils/time";
import { shortenAddress } from "@/utils/utils";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle } from "lucide-react";

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
    <div className="mx-4 flex items-center border-b py-[14px] last:border-b-0">
      <div className="mr-4 w-0 flex-auto">
        <div className="flex space-x-2">
          <div className="mb-1 items-center leading-6 md:flex md:min-w-0">
            <h4 className="my-0 text-lg font-semibold">
              {proposal.metadata?.title ?? `Proposal #${proposal.id}`}
            </h4>
          </div>
        </div>
        <div className="mr-4 inline">
          {getProposalId(proposal)} by{" "}
          {name || shortenAddress(proposal.author.id)}
        </div>
        <div className="text-muted-foreground inline space-x-4">
          <span>{proposal.vote_count} voters</span>
          <span>{proposal.scores_total} votes</span>
          <span>
            {formatDistanceToNow(proposal.max_end * 1000)}{" "}
            {isActive ? "left" : "ago"}
          </span>
        </div>
      </div>

      {isActive ? (
        "Voting Active"
      ) : (
        <div className="flex flex-col items-end gap-2">
          <Progress
            value={
              (Number(proposal.scores_1) / Number(proposal.scores_total)) * 100
            }
            max={Number(proposal.scores_total)}
            className="w-30"
          />

          <div>
            <div className="text-muted-foreground flex w-full items-center justify-end gap-2 text-sm">
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
