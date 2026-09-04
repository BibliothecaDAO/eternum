import { StatsShell } from "@/stats/stats-shell";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/stats/rewards/$tab")({
  component: StatsRewardsTab,
});

function StatsRewardsTab() {
  const { tab } = Route.useParams();
  return <StatsShell page="rewards" rewardTab={tab} />;
}
