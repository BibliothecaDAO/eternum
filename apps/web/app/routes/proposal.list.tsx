import { Suspense } from "react";
import { ProposalList } from "@/components/modules/governance/proposal-list";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/proposal/list")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="container p-6">
      <h1 className="pl-4 text-2xl font-semibold">Proposals</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="grid md:grid-cols-5">
          <div className="col-span-3 w-full">
            <ProposalList limit={20} />
          </div>
        </div>
      </Suspense>
    </div>
  );
}
