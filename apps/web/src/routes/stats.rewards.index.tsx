import { StatsShell } from "@/stats/stats-shell";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/stats/rewards/")({
  component: () => <StatsShell page="rewards" />,
});
