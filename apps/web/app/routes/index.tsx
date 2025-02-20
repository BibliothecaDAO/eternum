import type { Address } from "@starknet-react/core";
import { VeLords } from "@/abi/L2/VeLords";
import EthereumIcon from "@/components/icons/ethereum.svg?react";
import LordsIcon from "@/components/icons/lords.svg?react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { EthereumConnect } from "@/components/layout/ethereum-connect";
import { DelegateCard } from "@/components/modules/governance/delegate-card";
import { ProposalListItem } from "@/components/modules/governance/proposal-list-item";
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
import { getDelegateByIDQueryOptions } from "@/lib/getDelegates";
import { getL1UsersRealmsQueryOptions } from "@/lib/getL1Realms";
import { getPortfolioCollectionsQueryOptions } from "@/lib/getPortfolioCollections";
import { getProposalsQueryOptions } from "@/lib/getProposals";
import { getRealmsQueryOptions } from "@/lib/getRealms";
import {
  formatAddress,
  formatNumber,
  SUPPORTED_L1_CHAIN_ID,
  SUPPORTED_L2_CHAIN_ID,
} from "@/utils/utils";
import { useAccount, useBalance, useReadContract } from "@starknet-react/core";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { num } from "starknet";
import { formatEther } from "viem";
import { useAccount as useL1Account, useBalance as useL1Balance } from "wagmi";

import {
  CollectionAddresses,
  LORDS,
  StakingAddresses,
} from "@realms-world/constants";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  const { address } = useAccount();
  const { address: l1Address } = useL1Account();
  const l2RealmsQuery = useSuspenseQuery(
    getRealmsQueryOptions({
      address,
      collectionAddress: CollectionAddresses.realms[
        SUPPORTED_L2_CHAIN_ID
      ] as string,
    }),
  );
  const l2Realms = l2RealmsQuery.data;

  const l1UsersRealmsQuery = useSuspenseQuery(
    getL1UsersRealmsQueryOptions({
      address: l1Address,
    }),
  );
  const l1UsersRealms = l1UsersRealmsQuery.data;

  const usersCollectionsQuery = useSuspenseQuery(
    getPortfolioCollectionsQueryOptions({
      address: address,
    }),
  );
  const usersCollections = usersCollectionsQuery.data;
  const numberL2Realms = l2Realms?.data.length ?? 0;

  const { data } = useCurrentDelegate();
  const currentDelegateQuery = useQuery(
    getDelegateByIDQueryOptions({
      address: data ? formatAddress(num.toHex(BigInt(data))) : undefined,
    }),
  );
  const currentDelegate = currentDelegateQuery.data;

  const { data: proposalsQuery } = useSuspenseQuery(
    getProposalsQueryOptions({
      spaceIds: [
        "0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62",
      ],
      limit: 5,
      skip: 0,
      current: 1,
      searchQuery: "",
    }),
  );
  const proposals = proposalsQuery.proposals;

  const { data: starknetBalance } = useBalance({
    address,
    token: LORDS[SUPPORTED_L2_CHAIN_ID]?.address as Address,
    watch: true,
  });
  const { data: l1Balance } = useL1Balance({
    address: l1Address,
    token: LORDS[SUPPORTED_L1_CHAIN_ID]?.address as Address,
    watch: true,
  });
  const stakedBalance = 500; // replace with actual staked balance

  const { lordsClaimable } = useVeLordsClaims();

  const { balance: l2RealmsBalance } = useL2RealmsClaims();

  const { data: ownerLordsLock } = useReadContract({
    address: StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as Address,
    abi: VeLords,
    functionName: "get_lock_for",
    //enabled: !!l2Address,
    watch: true,
    args: address ? [address] : undefined,
  });
  return (
    <div className="flex flex-col gap-4 p-4 px-8">
      {/* Dashboard Statistics */}
      <div className="mb-4">
        <div className="flex justify-between">
          <h1 className="mb-2 text-2xl font-bold">Dashboard</h1>
          <EthereumConnect />
        </div>
        <div className="grid grid-cols-2 gap-10">
          {/* Realms Count */}
          <div className="mb-4">
            <h2 className="mb-2 text-xl font-semibold">Your Assets</h2>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Realms</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="flex w-full justify-between gap-2">
                    <span className="text-3xl">
                      {l1UsersRealms?.collections?.[0]?.ownership?.tokenCount ??
                        0}
                    </span>
                    <span className="flex items-center gap-2">
                      on <EthereumIcon className="h-6 w-6" /> Ethereum
                    </span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-3xl">
                      {
                        usersCollections?.data.find(
                          (collection) =>
                            collection.address ==
                            CollectionAddresses.realms[SUPPORTED_L2_CHAIN_ID],
                        )?.user_token_count
                      }
                    </span>
                    <span className="flex items-center gap-2">
                      on <StarknetIcon className="h-6 w-6" /> Starknet
                    </span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LordsIcon className="w-8" />
                    Lords
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="flex w-full justify-between gap-2">
                    <span className="text-3xl">
                      {formatNumber(Number(l1Balance?.formatted))}
                    </span>
                    <span className="flex items-center gap-2">
                      on <EthereumIcon className="h-6 w-6" /> Ethereum
                    </span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-3xl">
                      {formatNumber(Number(starknetBalance?.formatted))}
                    </span>
                    <span className="flex items-center gap-2">
                      on <StarknetIcon className="h-6 w-6" /> Starknet
                    </span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-3xl">
                      {formatNumber(
                        Number(
                          formatEther(BigInt(ownerLordsLock?.amount ?? 0)),
                        ),
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      staked for veLords
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Claimable Lords */}
          <div className="mb-4 md:w-1/2">
            <h2 className="mb-2 text-xl font-semibold">Your Claims</h2>
            <Card>
              <CardHeader>
                <CardTitle>veLords</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Link to={`/realms/claims`}>
                  <Badge className="flex justify-between gap-2 rounded">
                    <span className="flex text-3xl">
                      <LordsIcon className="mr-2 w-6" />
                      {l2RealmsBalance
                        ? formatNumber(Number(formatEther(l2RealmsBalance)))
                        : 0}
                    </span>
                    <span className="flex items-center gap-2">
                      Realms Emissions
                    </span>
                  </Badge>
                </Link>
                <Link to={`/velords`}>
                  <Badge className="flex justify-between gap-2 rounded">
                    <span className="flex text-3xl">
                      <LordsIcon className="mr-2 w-6" />
                      {lordsClaimable
                        ? formatNumber(Number(formatEther(lordsClaimable)))
                        : 0}
                    </span>
                    <span className="flex items-center gap-2">
                      from veLords staking
                    </span>
                  </Badge>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Delegate Profile */}
          <div className="mb-4">
            <h2 className="mb-2 text-xl font-semibold">Your Delegate</h2>
            <div className="flex flex-col gap-4">
              {currentDelegate && <DelegateCard delegate={currentDelegate} />}
            </div>
          </div>

          {/* Recent Proposals */}
          <div className="mb-4">
            <h2 className="mb-2 text-xl font-semibold">Recent Proposals</h2>
            <Card className="flex flex-col">
              {proposals?.map((proposal) => (
                <>{proposal && <ProposalListItem proposal={proposal} />}</>
              ))}
              <CardFooter className="mt-2 flex justify-end">
                <a
                  href="https://snapshot.box/#/sn:0x07bd3419669f9f0cc8f19e9e2457089cdd4804a4c41a5729ee9c7fd02ab8ab62/proposals"
                  target="__blank"
                >
                  <Button variant="outline" size={"sm"}>
                    View All
                  </Button>
                </a>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      {/* Realms Grid */}
      <div>
        <h2 className="mb-2 text-xl font-semibold">Your Realms</h2>
        {numberL2Realms > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {l2Realms?.data
              .slice(0, 5)
              .map((realm) => (
                <RealmCard key={realm.token_id} token={realm} isGrid={true} />
              ))}
            <Card>
              <Link to={`/realms`} className="h-full">
                <CardContent className="hover:bg-muted flex h-full flex-col items-center justify-center">
                  <Plus className="h-16 w-16" />
                  View All
                </CardContent>
              </Link>
            </Card>
          </div>
        ) : (
          <div>No Realms Found in wallet</div>
        )}
      </div>
    </div>
  );
}
