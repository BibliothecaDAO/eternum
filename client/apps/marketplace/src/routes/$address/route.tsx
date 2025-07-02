import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$address")({
  component: AccountProfilePage,
});

export default function AccountProfilePage() {
  const { address } = Route.useParams();

  return (
    <div>
      <h1>Account Profile Page {address}</h1>

      <Outlet />
    </div>
  );
}
