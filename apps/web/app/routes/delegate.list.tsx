import DelegateList from "@/components/modules/governance/delegate-list";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/delegate/list")({
  component: RouteComponent,
  /*loader: async ({ context: { trpcQueryUtils } }) => {
    await trpcQueryUtils.delegates.ensureData({});
    return;
  },*/
});

function RouteComponent() {
  return (
    <div>
      <DelegateList />
    </div>
  );
}
