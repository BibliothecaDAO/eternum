import { FullPageLoader } from "@/components/modules/full-page-loader";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/$address/")({
  component: CollectionPage,
  pendingComponent: FullPageLoader,
});

function CollectionPage() {
  return <div>Account Profile Page</div>;
}
