import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/revenue")({
  beforeLoad: () => {
    throw redirect({ to: "/stats/revenue" });
  },
});
