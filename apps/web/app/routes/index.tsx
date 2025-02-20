import type { Address } from "@starknet-react/core";
import { Suspense } from "react";
import { VeLords } from "@/abi/L2/VeLords";
import EthereumIcon from "@/components/icons/ethereum.svg?react";
import LordsIcon from "@/components/icons/lords.svg?react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { EthereumConnect } from "@/components/layout/ethereum-connect";
import { LoginCard } from "@/components/layout/login-card";
import { DelegateCard } from "@/components/modules/governance/delegate-card";
import { DelegateCardSkeleton } from "@/components/modules/governance/delegate-card-skeleton";
import { ProposalListItem } from "@/components/modules/governance/proposal-list-item";
import { Homepage } from "@/components/modules/homepage";
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

  if (!address) {
    return <LoginCard />;
  }
  return (
    <div className="flex flex-col gap-4 p-4 px-8">
      {/* Dashboard Statistics */}
      <div className="mb-4">
        <div className="flex justify-between">
          <h1 className="mb-2 text-2xl font-bold">Dashboard</h1>
          <EthereumConnect />
        </div>
        {<Homepage />}
      </div>
    </div>
  );
}
