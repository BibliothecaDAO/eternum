import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/eternum")({
  beforeLoad: () => {
    throw redirect({
      to: "/games/$slug",
      params: { slug: "realms-eternum" },
      replace: true,
    });
  },
});
