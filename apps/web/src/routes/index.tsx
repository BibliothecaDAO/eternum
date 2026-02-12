import { Suspense } from "react";
import { EthereumConnect } from "@/components/layout/ethereum-connect";
import { LoginCard } from "@/components/layout/login-card";
import { Homepage } from "@/components/modules/homepage/homepage";
import { HomepageSkeleton } from "@/components/modules/homepage/homepage-skeleteon";
import { getProposalsQueryOptions } from "@/lib/snapshot/getProposals";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useAccount } from "@starknet-react/core";
import { createFileRoute } from "@tanstack/react-router";

import { SnapshotSpaceAddresses } from "@realms-world/constants";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      getProposalsQueryOptions({
        spaceIds: [SnapshotSpaceAddresses[SUPPORTED_L2_CHAIN_ID] as string],
        limit: 5,
        skip: 0,
        current: 1,
        searchQuery: "",
      }),
    );
  },
  component: IndexComponent,
});

function IndexComponent() {
  const { address } = useAccount();
  if (!address) {
    return <LoginCard />;
  }
  return (
    <div className="flex flex-col gap-4 p-4 sm:px-8">
      {/* Dashboard Statistics */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <EthereumConnect />
        </div>
        <Suspense fallback={<HomepageSkeleton />}>
          <Homepage address={address} />
        </Suspense>
      </div>
    </div>
  );
}
