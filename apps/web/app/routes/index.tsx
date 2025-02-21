import { Suspense } from "react";
import { EthereumConnect } from "@/components/layout/ethereum-connect";
import { LoginCard } from "@/components/layout/login-card";
import { Homepage } from "@/components/modules/homepage";
import { HomepageSkeleton } from "@/components/modules/homepage/homepage-skeleteon";
import { useAccount } from "@starknet-react/core";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  const { address } = useAccount();
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
        <Suspense fallback={<HomepageSkeleton />}>
          <Homepage address={address} />
        </Suspense>
      </div>
    </div>
  );
}
