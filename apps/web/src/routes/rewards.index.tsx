import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rewards/")({
  beforeLoad: () => {
    throw redirect({ to: "/stats/rewards" });
  },
});
