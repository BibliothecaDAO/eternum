import { EternumConditionsModal } from "@/components/modules/eternum-conditions-modal";
import { SwapPanel } from "@/components/modules/swap-panel";
import { CountdownTimer } from "@/components/ui/elements/CountdownTimer";
import { createLazyFileRoute } from "@tanstack/react-router";
import { env } from "../../env";

export const Route = createLazyFileRoute("/trade")({
  component: () => (
    <div className="flex justify-center items-center h-full top-0 px-2 relative">
      <SwapPanel />
      <EternumConditionsModal open={true} onOpenChange={() => {}} />
      {env.VITE_PUBLIC_CHAIN == "mainnet" && <CountdownTimer targetDate={new Date("2024-12-11T12:00:00Z")} />}
    </div>
  ),
});
