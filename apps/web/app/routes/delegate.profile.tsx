import { DelegateProfileForm } from "@/components/modules/governance/delegate-profile-form";
import { trpc } from "@/router";
import { useAccount } from "@starknet-react/core";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/delegate/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  const { address } = useAccount();
  const { data: delegate } = trpc.delegates.byID.useQuery(
    { address: address ?? "0x" },
    {
      refetchInterval: 60000,
      //initialData: initialDelegate,
      enabled: !!address,
    },
  );
  return (
    <div className="container p-6">
      <h1 className="text-2xl font-semibold">Your Profile</h1>
      {delegate?.user}
      {delegate && (
        <DelegateProfileForm delegate={delegate} onSubmit={() => {}} />
      )}
    </div>
  );
}
