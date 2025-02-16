import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/delegate/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/delegate/profile"!</div>;
}
