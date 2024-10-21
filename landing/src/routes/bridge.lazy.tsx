import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/bridge")({
  component: Bridge,
});

function Bridge() {
  return <div>Bridge</div>;
}
