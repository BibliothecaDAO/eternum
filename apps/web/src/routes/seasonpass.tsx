import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/seasonpass")({
  beforeLoad: () => {
    throw redirect({ to: "/stats/season-pass" });
  },
});
