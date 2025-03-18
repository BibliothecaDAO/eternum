import { Card } from "@/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/coming-soon/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="to-background via-background-sidebar from-secondary flex h-screen items-center justify-center bg-gradient-to-r">
      <Card className="rounded bg-white bg-opacity-80 p-12 text-center shadow-lg">
        <h1 className="mb-4 text-5xl font-bold">Coming Soon</h1>
        <p className="text-xl">
          We're working hard to bring you an amazing new experience. Stay tuned!
        </p>
      </Card>
    </div>
  );
}
