import type { Address } from "@starknet-react/core";
import { Suspense } from "react";
import { VeLords } from "@/abi/L2/VeLords";
import BridgeIcon from "@/components/icons/bridge.svg?react";
import EthereumIcon from "@/components/icons/ethereum.svg?react";
import LordsIcon from "@/components/icons/lords.svg?react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { DelegateCard } from "@/components/modules/governance/delegate-card";
import { DelegateCardSkeleton } from "@/components/modules/governance/delegate-card-skeleton";
import { RealmCard } from "@/components/modules/realms/realm-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCurrentDelegate } from "@/hooks/governance/use-current-delegate";
import { useL2RealmsClaims } from "@/hooks/use-l2-realms-claims";
import useVeLordsClaims from "@/hooks/use-velords-claims";
import { getAccountTokensQueryOptions } from "@/lib/eternum/getPortfolioCollections";
import { getRealmsQueryOptions } from "@/lib/eternum/getRealms";
import { getDelegateByIDQueryOptions } from "@/lib/getDelegates";
import { getL1UsersRealmsQueryOptions } from "@/lib/getL1Realms";
import {
  formatAddress,
  formatNumber,
  SUPPORTED_L1_CHAIN_ID,
  SUPPORTED_L2_CHAIN_ID,
} from "@/utils/utils";
import {
  useBalance,
  useReadContract,
  useSendTransaction,
} from "@starknet-react/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Gavel, Plus } from "lucide-react";
import { num } from "starknet";
import { formatEther } from "viem";
import { useAccount as useL1Account, useBalance as useL1Balance } from "wagmi";

import {
  CollectionAddresses,
  LORDS,
  SnapshotSpaceAddresses,
  StakingAddresses,
} from "@realms-world/constants";

import { ProposalList } from "../governance/proposal-list";

export function Homepage({ address }: { address: `0x${string}` }) {
  //const { address } = useAccount();
  const { address: l1Address } = useL1Account();
  /*const l2RealmsQuery = useSuspenseQuery(
    getRealmsQueryOptions({
      address,
      collectionAddress: CollectionAddresses.realms[
        SUPPORTED_L2_CHAIN_ID
      ] as string,
    }),
  );
  const l2Realms = l2RealmsQuery.data;*/

  const l1UsersRealmsQuery = useSuspenseQuery(
    getL1UsersRealmsQueryOptions({
      address: l1Address ?? "",
    }),
  );
  const l1UsersRealms = l1UsersRealmsQuery.data;

  const accountTokensQuery = useSuspenseQuery(
    getAccountTokensQueryOptions({
      address: address,
    }),
  );
  const accountTokens = accountTokensQuery.data;

  const { data } = useCurrentDelegate();
  const currentDelegateQuery = useSuspenseQuery(
    getDelegateByIDQueryOptions({
      address:
        data && BigInt(data) != 0n
          ? formatAddress(num.toHex(BigInt(data)))
          : undefined,
    }),
  );
  const currentDelegate = currentDelegateQuery.data;

  const { data: starknetBalance } = useBalance({
    address,
    token: LORDS[SUPPORTED_L2_CHAIN_ID]?.address as Address,
    watch: true,
  });
  const { data: l1Balance } = useL1Balance({
    address: l1Address,
    token: LORDS[SUPPORTED_L1_CHAIN_ID]?.address as Address,
  });

  const { lordsClaimable, claimCall } = useVeLordsClaims();

  const { balance: l2RealmsBalance, calls: l2RealmsClaimCall } =
    useL2RealmsClaims();

  const { data: ownerLordsLock } = useReadContract({
    address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as Address,
    abi: VeLords,
    functionName: "get_lock_for",
    watch: true,
    args: [address],
  });

  // Prepare the function to send the claim rewards transaction.
  const { sendAsync: claimAllRewards, isPending: claimIsSubmitting } =
    useSendTransaction({
      calls: [...(claimCall ?? []), ...l2RealmsClaimCall],
    });

  return (
    <>
      <div className="space-y-8">
        {/* Assets Section */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Realms Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Realms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">
                    <Suspense
                      fallback={
                        <div className="text-muted-foreground">Loading...</div>
                      }
                    >
                      {l1UsersRealms?.collections?.[0]?.ownership?.tokenCount ??
                        0}
                    </Suspense>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <EthereumIcon className="h-4 w-4" />
                    Ethereum
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">
                    {accountTokens.length}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <StarknetIcon className="h-4 w-4" />
                    Starknet
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 pt-4">
              <Link to={`/realms/bridge`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <BridgeIcon className="mr-2 h-4 w-4" />
                  Bridge
                </Button>
              </Link>
              <a
                href="https://market.realms.world/"
                target="_blank"
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full">
                  <Gavel className="mr-2 h-4 w-4" />
                  Market
                </Button>
              </a>
            </CardFooter>
          </Card>

          {/* Lords Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <LordsIcon className="h-6 w-6" />
                Lords
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">
                    {formatNumber(Number(l1Balance?.formatted ?? 0))}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <EthereumIcon className="h-4 w-4" />
                    Ethereum
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">
                    {formatNumber(Number(starknetBalance?.formatted))}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <StarknetIcon className="h-4 w-4" />
                    Starknet
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">
                    {formatNumber(
                      Number(formatEther(BigInt(ownerLordsLock?.amount ?? 0))),
                    )}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Staked (veLords)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Claims Section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Available Claims</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Link to={`/realms/claims`}>
                  <div className="hover:bg-muted/50 group rounded-lg border p-4 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <LordsIcon className="h-6 w-6" />
                        <div>
                          <div className="font-semibold">Realms Emissions</div>
                          <div className="text-muted-foreground text-sm">
                            Claim your realm rewards
                          </div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold">
                        {l2RealmsBalance
                          ? formatNumber(Number(formatEther(l2RealmsBalance)))
                          : 0}
                      </div>
                    </div>
                  </div>
                </Link>

                <Link to={`/velords`}>
                  <div className="hover:bg-muted/50 group rounded-lg border p-4 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <LordsIcon className="h-6 w-6" />
                        <div>
                          <div className="font-semibold">veLords Rewards</div>
                          <div className="text-muted-foreground text-sm">
                            Staking rewards available
                          </div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold">
                        {lordsClaimable
                          ? formatNumber(Number(formatEther(lordsClaimable)))
                          : 0}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </CardContent>
            <CardFooter className="pt-0">
              <Button
                onClick={() => claimAllRewards()}
                className="w-full"
                disabled={claimIsSubmitting}
              >
                {claimIsSubmitting ? "Claiming..." : "Claim All Rewards"}
              </Button>
            </CardFooter>
          </Card>

          {/* Delegate Section */}
          <div className="space-y-4">
            <Suspense fallback={<DelegateCardSkeleton />}>
              {!currentDelegate ||
              (currentDelegate.user && BigInt(currentDelegate.user) == 0n) ? (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Governance</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <h3 className="mb-2 text-lg font-semibold">
                        No Delegate Selected
                      </h3>
                      <p className="text-muted-foreground mb-4 text-sm">
                        Delegate your Realms to participate in governance and
                        earn $LORDS emissions
                      </p>
                      <Link to={`/delegate/list`}>
                        <Button className="w-full">Choose a Delegate</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <DelegateCard
                  delegate={{
                    user: currentDelegate.user,
                    delegateProfile: currentDelegate.delegateProfile
                      ? {
                          twitter:
                            currentDelegate.delegateProfile.twitter ||
                            undefined,
                          github:
                            currentDelegate.delegateProfile.github || undefined,
                          telegram:
                            currentDelegate.delegateProfile.telegram ||
                            undefined,
                          discord:
                            currentDelegate.delegateProfile.discord ||
                            undefined,
                          interests:
                            currentDelegate.delegateProfile.interests ||
                            undefined,
                          statement:
                            currentDelegate.delegateProfile.statement ||
                            undefined,
                        }
                      : undefined,
                    delegatedVotes: currentDelegate.delegatedVotes,
                    id: currentDelegate.id,
                  }}
                />
              )}
            </Suspense>
          </div>
        </div>

        {/* Proposals Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg">Recent Proposals</CardTitle>
            <Link to={`/proposal/list`}>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <Suspense fallback={<div className="p-6">Loading proposals...</div>}>
            <ProposalList delegateId={currentDelegate?.user} />
          </Suspense>
        </Card>

        {/* Realms Grid */}
        <div>
          {accountTokens?.length > 0 ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg">Your Realms</CardTitle>
                {accountTokens?.length > 5 && (
                  <Link to={`/realms`}>
                    <Button variant="outline" size="sm">
                      View All ({accountTokens.length})
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {accountTokens
                    ?.slice(0, 5)
                    .map((realm: any) => (
                      <RealmCard
                        key={realm.token_id}
                        token={realm}
                        isGrid={true}
                      />
                    ))}
                  {accountTokens.length > 5 && (
                    <Card className="flex items-center justify-center">
                      <Link
                        to={`/realms`}
                        className="flex h-full w-full items-center justify-center p-6"
                      >
                        <div className="text-center">
                          <Plus className="text-muted-foreground mx-auto h-8 w-8" />
                          <div className="text-muted-foreground mt-2 text-sm">
                            +{accountTokens.length - 5} more
                          </div>
                        </div>
                      </Link>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Your Realms</CardTitle>
              </CardHeader>
              <CardContent className="p-12 text-center">
                <div className="text-muted-foreground text-lg">
                  No Realms found in your wallet
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  Visit the marketplace to acquire your first Realm
                </p>
                <a
                  href="https://market.realms.world/"
                  target="_blank"
                  className="mt-4 inline-block"
                >
                  <Button>
                    <Gavel className="mr-2 h-4 w-4" />
                    Browse Marketplace
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
