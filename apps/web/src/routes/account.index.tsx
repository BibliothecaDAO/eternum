import { Suspense } from "react";
import { EthereumConnect } from "@/components/layout/ethereum-connect";
import { LoginCard } from "@/components/layout/login-card";
import { Homepage } from "@/components/modules/homepage/homepage";
import { HomepageSkeleton } from "@/components/modules/homepage/homepage-skeleteon";
import { getProposalsQueryOptions } from "@/lib/snapshot/getProposals";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useAccount } from "@starknet-start/react";
import { createFileRoute } from "@tanstack/react-router";

import { SnapshotSpaceAddresses } from "@realms-world/chain";

export const Route = createFileRoute("/account/")({
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
    <div className="realm-shell flex flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      {/* Dashboard Statistics */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="realm-eyebrow">Account Portal</p>
            <h1 className="realm-page-title text-3xl sm:text-4xl">Dashboard</h1>
          </div>
          <EthereumConnect />
        </div>
        <Suspense fallback={<HomepageSkeleton />}>
          <Homepage address={address} />
        </Suspense>
      </div>
    </div>
  );
}
