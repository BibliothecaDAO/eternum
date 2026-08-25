import { ProposalResults } from "@/components/modules/governance/proposal-results";
import { ProposalUserVoteBadge } from "@/components/modules/governance/proposal-user-vote-badge";
import { ProposalVoteAction } from "@/components/modules/governance/proposal-vote-action";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useCurrentDelegate } from "@/hooks/governance/use-current-delegate";
import { useVotingPower } from "@/hooks/governance/use-voting-power";
import { useStarkDisplayName } from "@/hooks/use-stark-name";
import { getProposalQueryOptions } from "@/lib/snapshot/getProposals";
import { getUserVotesQueryOptions } from "@/lib/snapshot/getUserVotes";
import { isMatchingProposalVote } from "@/lib/snapshot/proposal-id";
import {
  formatAddress,
  shortenAddress,
  SUPPORTED_L2_CHAIN_ID,
} from "@/utils/utils";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { env } from "env";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { num } from "starknet";

import { SnapshotSpaceAddresses } from "@realms-world/constants";

// Define the expected types for the proposal data we need
/*interface ProposalData {
  metadata?: {
    title?: string;
    body?: string;
  };
  author?: {
    id: string;
  };
  created?: number;
}*/

export const Route = createFileRoute("/proposal/$id")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const { id } = params;
    return context.queryClient.ensureQueryData(getProposalQueryOptions({ id }));
  },
});

function RouteComponent() {
  const { id } = Route.useParams();

  const { data: votingPower } = useVotingPower();

  const { data: proposalQuery } = useSuspenseQuery(
    getProposalQueryOptions({
      id,
    }),
  );
  const { data } = useCurrentDelegate();
  const delegateAddress =
    data && BigInt(data) !== 0n ? formatAddress(num.toHex(BigInt(data))) : "";

  const { data: userVotesQuery } = useQuery(
    getUserVotesQueryOptions({
      spaceIds: [SnapshotSpaceAddresses[SUPPORTED_L2_CHAIN_ID] as string],
      limit: 100,
      skip: 0,
      voter: delegateAddress,
    }),
  );

  // Find the vote that matches this proposal ID
  const userVoteRef = userVotesQuery?.votes?.find((vote) =>
    isMatchingProposalVote(vote?.proposal, id),
  );

  const proposal = proposalQuery.proposal;
  const authorAddress = (proposal?.author.id ?? "0x0") as `0x${string}`;
  const name = useStarkDisplayName(authorAddress);

  if (!proposal) {
    return <div>Proposal not found</div>;
  }

  const title = proposal.metadata?.title as string;
  let body = proposal.metadata?.body as string;
  const authorId = proposal.author.id;
  const createdTime = proposal.created
    ? new Date(proposal.created * 1000)
    : null;

  if (body && typeof body === "string") {
    body = body.replace(/ipfs:\/\/\S+/g, (match) =>
      match.replace("ipfs://", env.VITE_PUBLIC_IPFS_GATEWAY ?? ""),
    );
  }
  const isActive = proposal.max_end * 1000 > Date.now();

  // Determine proposal status if vote has ended
  const getProposalStatus = () => {
    if (isActive) return null;

    if (
      (proposal.scores_total ?? 0) >= 1500 &&
      Number(proposal.scores_1 ?? 0) > Number(proposal.scores_2 ?? 0)
    ) {
      return {
        label: "Passed",
        className: "text-success border-success",
        icon: CheckCircle2,
      };
    } else if ((proposal.scores_total ?? 0) < 1500) {
      return {
        label: "Quorum not met",
        className: "text-sm text-muted-foreground border-muted-foreground",
        icon: XCircle,
      };
    } else {
      return {
        label: "Failed",
        className: "border-destructive text-destructive",
        icon: MinusCircle,
      };
    }
  };
  const proposalStatus = getProposalStatus();

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "20rem",
        "--sidebar-width-mobile": "20rem",
      }}
    >
      <SidebarInset>
        <div className="container mx-auto max-w-4xl py-8">
          <Card className="mb-8">
            <CardHeader>
              <div className="flex flex-col gap-2">
                <p className="realm-eyebrow">Governance</p>
                <div className="flex items-center justify-between gap-3">
                  <h1 className="realm-page-title text-3xl sm:text-4xl">
                    {title}
                  </h1>
                  {proposalStatus && (
                    <Badge
                      variant={"outline"}
                      className={"text-base " + proposalStatus.className}
                    >
                      <proposalStatus.icon className="mr-1.5 w-5" />
                      {proposalStatus.label}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  {authorId && (
                    <>
                      <span>
                        Proposed by {name || shortenAddress(proposal.author.id)}
                      </span>
                      <span>•</span>
                    </>
                  )}
                  {createdTime && (
                    <span>{formatDistanceToNow(createdTime)} ago</span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {body && (
                <MarkdownRenderer
                  content={body}
                  className="text-card-foreground"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
      <Sidebar
        side="right"
        variant="inset"
        className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      >
        <SidebarContent>
          {votingPower && (
            <Badge
              variant={"outline"}
              className="mx-auto flex max-w-30 justify-center rounded text-center text-lg"
            >
              {Number(votingPower).toString()} Realms
            </Badge>
          )}
          <SidebarGroup>
            {isActive && (
              <>
                <SidebarGroupLabel>Cast Your Vote</SidebarGroupLabel>
                <ProposalVoteAction proposal={proposal} />
              </>
            )}
            {userVoteRef && (
              <>
                <SidebarGroupLabel>You Voted:</SidebarGroupLabel>
                <ProposalUserVoteBadge choice={userVoteRef.choice} />
              </>
            )}
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Results</SidebarGroupLabel>
            <ProposalResults proposal={proposal} />
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
