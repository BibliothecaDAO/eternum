import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/rewards/$tab")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/stats/rewards/$tab", params: { tab: params.tab } });
  },
});
