import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/blitz")({
  beforeLoad: () => {
    throw redirect({
      to: "/games/$slug",
      params: { slug: "blitz" },
      replace: true,
    });
  },
});
