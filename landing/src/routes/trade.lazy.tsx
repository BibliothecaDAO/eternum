import { SwapPanel } from "@/components/modules/swap-panel";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/trade")({
  component: () => (
    <div className="flex justify-center items-center h-full">
      <SwapPanel />
    </div>
  ),
});
