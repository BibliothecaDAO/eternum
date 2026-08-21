import type { RealmInventoryToken } from "@/lib/realms/get-realm-inventory";
import type { Address } from "@starknet-start/react";
import { Suspense } from "react";
import { VeLords } from "@/abi/L2/VeLords";
import BridgeIcon from "@/components/icons/bridge.svg?react";
import EthereumIcon from "@/components/icons/ethereum.svg?react";
import LordsIcon from "@/components/icons/lords.svg?react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { DelegateCard } from "@/components/modules/governance/delegate-card";
import { DelegateCardSkeleton } from "@/components/modules/governance/delegate-card-skeleton";
import { OwnershipStatusAlert } from "@/components/modules/realms/ownership-status-alert";
import { RealmCard } from "@/components/modules/realms/realm-card";
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
import { getDelegateByIDQueryOptions } from "@/lib/getDelegates";
import { getL1UsersRealmsQueryOptions } from "@/lib/getL1Realms";
import { getRealmInventoryQueryOptions } from "@/lib/realms/get-realm-inventory";
import { getRealmInventoryViewState } from "@/lib/realms/inventory-ui";
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
} from "@starknet-start/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Gavel, Plus } from "lucide-react";
import { num } from "starknet";
import { formatEther } from "viem";
import { useAccount as useL1Account, useBalance as useL1Balance } from "wagmi";

import { LORDS, StakingAddresses } from "@realms-world/constants";

import { ProposalList } from "../governance/proposal-list";

/** Max realm cards shown on the homepage before "View All" */
const HOMEPAGE_REALMS_PREVIEW_COUNT = 5;

const INTERACTIVE_ROW_CLASS =
  "realm-interactive-row group hover:bg-accent/70 rounded-lg p-4 transition-colors hover:border-[color:var(--realm-accent-brass)]";

function StatValue({ children }: { children: React.ReactNode }) {
  return <div className="realm-stat text-3xl font-bold">{children}</div>;
}

export function Homepage({ address }: { address: `0x${string}` }) {
  const { address: l1Address } = useL1Account();

  const l1UsersRealmsQuery = useSuspenseQuery(
    getL1UsersRealmsQueryOptions({
      address: l1Address,
    }),
  );
  const accountTokensQuery = useQuery(
    getRealmInventoryQueryOptions({
      address: address,
    }),
  );
  const l1UsersRealms = l1UsersRealmsQuery.data;
  const accountInventory = accountTokensQuery.data;
  const accountTokens = accountInventory?.tokens ?? [];
  const accountInventoryViewState = getRealmInventoryViewState({
    isPending: accountTokensQuery.isPending,
    isError: accountTokensQuery.isError,
    status: accountInventory?.status,
  });
  const l1RealmCount = l1UsersRealms?.collections[0]?.ownership.tokenCount ?? 0;

  const { data } = useCurrentDelegate();
  const delegateAddress =
    data && BigInt(data) !== 0n
      ? formatAddress(num.toHex(BigInt(data)))
      : undefined;
  const currentDelegateQuery = useQuery(
    getDelegateByIDQueryOptions({
      address: delegateAddress,
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

  // Prepare the functions to send claim rewards transactions.
  const {
    sendAsync: claimVeLordsRewards,
    isPending: claimVeLordsIsSubmitting,
  } = useSendTransaction({
    calls: claimCall ?? [],
  });

  const { sendAsync: claimRealmsRewards, isPending: claimRealmsIsSubmitting } =
    useSendTransaction({
      calls: l2RealmsClaimCall,
    });

  return (
    <>
      <div className="space-y-6">
        {/* Assets Section */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Realms Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Realms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <StatValue>{l1RealmCount}</StatValue>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <EthereumIcon className="h-4 w-4" />
                    Ethereum
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <StatValue>
                    {accountInventoryViewState === "loading"
                      ? "…"
                      : accountInventoryViewState !== "ready"
                        ? "—"
                        : accountTokens.length}
                  </StatValue>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <StarknetIcon className="h-4 w-4" />
                    Starknet
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 pt-2">
              <Link to={`/realms/bridge`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <BridgeIcon className="mr-2 h-4 w-4" />
                  Bridge
                </Button>
              </Link>
              <a
                href="https://market.realms.world"
                target="_blank"
                rel="noopener noreferrer"
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
              <CardTitle className="flex items-center gap-2">
                <LordsIcon className="h-6 w-6" />
                Lords
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <StatValue>
                    {formatNumber(Number(l1Balance?.formatted ?? 0))}
                  </StatValue>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <EthereumIcon className="h-4 w-4" />
                    Ethereum
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <StatValue>
                    {formatNumber(Number(starknetBalance?.formatted))}
                  </StatValue>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <StarknetIcon className="h-4 w-4" />
                    Starknet
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <StatValue>
                    {formatNumber(
                      Number(formatEther(BigInt(ownerLordsLock?.amount ?? 0))),
                    )}
                  </StatValue>
                  <div className="text-muted-foreground text-sm">
                    Staked (veLords)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Claims Section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Available Claims</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <Link to={`/realms/claims`}>
                  <div className={INTERACTIVE_ROW_CLASS}>
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
                      <div className="realm-stat text-2xl font-bold">
                        {l2RealmsBalance
                          ? formatNumber(Number(formatEther(l2RealmsBalance)))
                          : 0}
                      </div>
                    </div>
                  </div>
                </Link>

                <Link to={`/velords`}>
                  <div className={INTERACTIVE_ROW_CLASS}>
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
                      <div className="realm-stat text-2xl font-bold">
                        {lordsClaimable
                          ? formatNumber(Number(formatEther(lordsClaimable)))
                          : 0}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 pt-0">
              <Button
                onClick={() => claimRealmsRewards()}
                className="flex-1"
                disabled={
                  claimRealmsIsSubmitting ||
                  !l2RealmsBalance ||
                  l2RealmsBalance === 0n
                }
                variant="outline"
              >
                {claimRealmsIsSubmitting ? "Claiming..." : "Claim Realms"}
              </Button>
              <Button
                onClick={() => claimVeLordsRewards()}
                className="flex-1"
                disabled={
                  claimVeLordsIsSubmitting ||
                  !lordsClaimable ||
                  lordsClaimable === 0n
                }
                variant="outline"
              >
                {claimVeLordsIsSubmitting ? "Claiming..." : "Claim veLords"}
              </Button>
            </CardFooter>
          </Card>

          {/* Delegate Section */}
          <div className="space-y-4">
            {currentDelegateQuery.isLoading ? (
              <DelegateCardSkeleton />
            ) : !currentDelegate ||
              (currentDelegate.user && BigInt(currentDelegate.user) === 0n) ? (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Governance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <h3 className="realm-card-title mb-2">
                      No Delegate Selected
                    </h3>
                    <p className="text-muted-foreground mb-4 text-sm">
                      Delegate your Realms to participate in governance
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
                          currentDelegate.delegateProfile.twitter ?? undefined,
                        github:
                          currentDelegate.delegateProfile.github ?? undefined,
                        telegram:
                          currentDelegate.delegateProfile.telegram ?? undefined,
                        discord:
                          currentDelegate.delegateProfile.discord ?? undefined,
                        interests:
                          currentDelegate.delegateProfile.interests ??
                          undefined,
                        statement: currentDelegate.delegateProfile.statement,
                      }
                    : undefined,
                  delegatedVotes: currentDelegate.delegatedVotes,
                  id: currentDelegate.id,
                }}
              />
            )}
          </div>
        </div>

        {/* Proposals Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle>Recent Proposals</CardTitle>
            <Link to={`/proposal/list`}>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div>Loading proposals...</div>}>
              <ProposalList delegateId={currentDelegate?.user} />
            </Suspense>
          </CardContent>
        </Card>

        {/* Realms Grid */}
        <div>
          {accountInventoryViewState === "loading" ? (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Your Realms</CardTitle>
              </CardHeader>
              <CardContent>Loading Realm inventory...</CardContent>
            </Card>
          ) : accountInventoryViewState !== "ready" ? (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Your Realms</CardTitle>
              </CardHeader>
              <CardContent>
                <OwnershipStatusAlert
                  status={accountInventory?.status}
                  isError={accountInventoryViewState === "error"}
                  onRetry={() => void accountTokensQuery.refetch()}
                />
              </CardContent>
            </Card>
          ) : accountTokens.length > 0 ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle>Your Realms</CardTitle>
                {accountTokens.length > HOMEPAGE_REALMS_PREVIEW_COUNT && (
                  <Link to={`/realms`}>
                    <Button variant="outline" size="sm">
                      View All ({accountTokens.length})
                    </Button>
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {accountTokens
                    .slice(0, HOMEPAGE_REALMS_PREVIEW_COUNT)
                    .map((realm: RealmInventoryToken) => (
                      <RealmCard
                        key={realm.token_id}
                        token={realm}
                        isGrid={true}
                      />
                    ))}
                  {accountTokens.length > HOMEPAGE_REALMS_PREVIEW_COUNT && (
                    <Card className="flex items-center justify-center">
                      <Link
                        to={`/realms`}
                        className="flex h-full w-full items-center justify-center p-4"
                      >
                        <div className="text-center">
                          <Plus className="text-muted-foreground mx-auto h-8 w-8" />
                          <div className="text-muted-foreground mt-2 text-sm">
                            +
                            {accountTokens.length -
                              HOMEPAGE_REALMS_PREVIEW_COUNT}{" "}
                            more
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
                <CardTitle>Your Realms</CardTitle>
              </CardHeader>
              <CardContent className="pb-6 text-center">
                <div className="text-muted-foreground text-lg">
                  No Realms found in your wallet
                </div>
                <p className="text-muted-foreground mt-2 text-sm">
                  Visit the marketplace to acquire your first Realm
                </p>
                <a
                  href="https://market.realms.world"
                  target="_blank"
                  rel="noopener noreferrer"
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
