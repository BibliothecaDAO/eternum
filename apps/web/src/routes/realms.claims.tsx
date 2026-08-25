import { ClaimRewards } from "@/components/modules/realms/claims";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/realms/claims")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div>
      <ClaimRewards />
    </div>
  );
}
