import { StatsShell } from "@/stats/stats-shell";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/stats/revenue")({
  component: () => <StatsShell page="revenue" />,
});
