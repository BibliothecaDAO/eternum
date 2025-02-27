import { ProposalResults } from "@/components/modules/governance/proposal-results";
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
import { useVotingPower } from "@/hooks/governance/use-voting-power";
import { getProposalQueryOptions } from "@/lib/getProposals";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { env } from "env";

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

  // Cast the proposal to our expected type
  const proposal = proposalQuery.proposal;
  const title = proposal.metadata?.title ?? "Untitled Proposal";
  let body = proposal.metadata?.body ?? "";
  const authorId = proposal.author?.id ?? "";
  const createdTime = proposal.created
    ? new Date(proposal.created * 1000)
    : null;

  if (body && typeof body === "string") {
    body = body.replace(/ipfs:\/\/\S+/g, (match) =>
      match.replace("ipfs://", env.VITE_PUBLIC_IPFS_GATEWAY ?? ""),
    );
  }
  console.log(body);
  const isActive = proposal.max_end * 1000 > Date.now();

  return (
    <SidebarProvider>
      <SidebarInset>
        <div className="container mx-auto max-w-4xl py-8">
          <Card className="mb-8">
            <CardHeader>
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold">{title}</h1>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  {authorId && (
                    <>
                      <span>Proposed by {authorId.substring(0, 8)}...</span>
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
        <SidebarContent className="w-60">
          {votingPower && (
            <Badge
              variant={"outline"}
              className="max-w-30 flex justify-center text-center text-lg"
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
