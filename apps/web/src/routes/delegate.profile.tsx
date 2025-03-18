import { LoginCard } from "@/components/layout/login-card";
import { DelegateProfileForm } from "@/components/modules/governance/delegate-profile-form";
import { Login } from "@/components/modules/governance/sign-in-with-starknet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useStarkDisplayName } from "@/hooks/use-stark-name";
import { getDelegateByIDQueryOptions } from "@/lib/getDelegates";
import { formatNumber } from "@/utils/utils";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Users, Vote } from "lucide-react";

export const Route = createFileRoute("/delegate/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  const { address } = useAccount();
  const { data: delegate, isLoading } = useQuery(
    getDelegateByIDQueryOptions({ address: address }),
  );
  const name = useStarkDisplayName(address as `0x${string}`);

  if (!address) {
    return <LoginCard />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "25rem",
          "--sidebar-width-mobile": "25rem",
        } as React.CSSProperties
      }
    >
      <SidebarInset>
        <div className="container mx-auto p-8">
          <h1 className="mb-4 text-2xl font-semibold">Your Profile</h1>
          {!isLoading && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <DelegateProfileForm
                  delegate={delegate}
                  onSubmit={() => void 0}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
      <Sidebar
        side="right"
        variant="inset"
        className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      >
        <SidebarContent>
          <SidebarHeader>
            <Login />
          </SidebarHeader>
          <SidebarGroup>
            <SidebarGroupLabel>Profile Information</SidebarGroupLabel>
            <div className="p-4 text-sm">
              {name ? (
                <p>{name}</p>
              ) : (
                <p>Connect your wallet to view your profile information</p>
              )}
            </div>
          </SidebarGroup>

          {delegate && (
            <SidebarGroup>
              <SidebarGroupLabel>Delegation Statistics</SidebarGroupLabel>
              <div className="space-y-4 p-4">
                <div className="flex items-center gap-3">
                  <Vote className="text-primary h-5 w-5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Delegated Votes
                      </span>
                      <Badge variant="outline" className="text-primary text-xl">
                        {formatNumber(Number(delegate.delegatedVotes)) || "0"}{" "}
                        Realms
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Users className="text-primary h-5 w-5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Token Holders Represented
                      </span>
                      <Badge variant="outline" className="text-primary text-xl">
                        {delegate.tokenHoldersRepresentedAmount || "0"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/*<div className="flex items-center gap-3">
                  <BarChart3 className="text-primary h-5 w-5" />
                  <div className="flex-1">
                    <div className="mb-1 flex justify-between">
                      <span className="text-sm font-medium">
                        Voting Participation
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {delegate.participationRate || "75"}%
                      </span>
                    </div>
                    <Progress
                      value={delegate.participationRate || 75}
                      className="h-2"
                    />
                  </div>
                </div>

                <div className="text-muted-foreground mt-2 text-xs">
                  <p className="flex justify-between">
                    <span>Total Proposals Voted:</span>
                    <span>{delegate.votedProposalsCount || "12"}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Last Vote:</span>
                    <span>
                      {delegate.lastVoteTimestamp
                        ? new Date(
                            delegate.lastVoteTimestamp,
                          ).toLocaleDateString()
                        : "2 days ago"}
                    </span>
                  </p>
                </div>*/}
              </div>
            </SidebarGroup>
          )}

          {/*<SidebarGroup>
            <SidebarGroupLabel>Actions</SidebarGroupLabel>
            <div className="flex flex-col gap-2 p-4">
              <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-4 py-2 text-sm">
                Manage Delegations
              </button>
              <button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded px-4 py-2 text-sm">
                View Voting History
              </button>
            </div>
          </SidebarGroup>*/}
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
