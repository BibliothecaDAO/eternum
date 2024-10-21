import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/trade")({
  component: () => <div>Hello /trade!</div>,
});
