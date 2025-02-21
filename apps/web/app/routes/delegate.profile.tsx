import { DelegateProfileForm } from "@/components/modules/governance/delegate-profile-form";
import { Login } from "@/components/modules/governance/sign-in-with-starknet";
import { getDelegateByIDQueryOptions } from "@/lib/getDelegates";
import { useAccount } from "@starknet-react/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/delegate/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  const { address } = useAccount();
  const { data: delegate } = useQuery(
    getDelegateByIDQueryOptions({ address: address ?? "0x" }),
  );
  return (
    <div className="container p-6">
      <h1 className="text-2xl font-semibold">Your Profile</h1>
      <Login />
      {delegate && (
        <DelegateProfileForm delegate={delegate} onSubmit={() => void 0} />
      )}
    </div>
  );
}
