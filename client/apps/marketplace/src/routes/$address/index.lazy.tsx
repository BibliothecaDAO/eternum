import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/$address/")({
  component: AccountProfilePage,
});

export default function AccountProfilePage() {
  const { address } = Route.useParams();

  return <div>Account Profile Page {address}</div>;
}
