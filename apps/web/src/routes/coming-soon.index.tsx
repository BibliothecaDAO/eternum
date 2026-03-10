import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/coming-soon/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="realm-shell flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-xl text-center">
        <CardHeader>
          <PageHeader
            eyebrow="Portal"
            title="Coming Soon"
            description="We're working hard to bring you an amazing new experience. Stay tuned!"
            className="mb-0 text-center md:flex-col md:items-center"
          />
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
