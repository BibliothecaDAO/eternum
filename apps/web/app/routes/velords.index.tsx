import { StakeLords } from "@/components/modules/velords/stake-lords";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/velords/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="container p-6">
        <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">veLords Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Here&rsquo;s an overview of your contacts. Manage or create new ones
            with ease!
          </p>
        </div>
      </div>
      <div className="md:grids-col-2 grid md:gap-4 lg:grid-cols-10 xl:grid-cols-11 xl:gap-4">
        <div className="space-y-4 lg:col-span-3 xl:space-y-4">
          <StakeLords />
        </div>
      </div>
    </div>
    </div>
  );
}
