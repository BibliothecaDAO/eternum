import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/delegates/")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/delegates/"!</div>;
}
