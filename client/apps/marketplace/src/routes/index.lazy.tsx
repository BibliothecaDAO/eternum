import { createLazyFileRoute, redirect } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  // Redirect to the trade page
  redirect({ to: "/trade" });

  return null;
}
