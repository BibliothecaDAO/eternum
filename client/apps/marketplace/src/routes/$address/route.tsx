import { displayAddress } from "@/lib/utils";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$address")({
  component: AccountProfilePage,
});

export default function AccountProfilePage() {
  const { address } = Route.useParams();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Page Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2 pt-4">Account Profile</h1>
      <p className="text-center text-muted-foreground mb-6">View and manage your NFT collections</p>

      {/* Account Address */}
      <div className="text-center mb-6">
        <div className="text-lg font-mono text-muted-foreground break-all">{displayAddress(address)}</div>
      </div>

      <Outlet />
    </div>
  );
}
