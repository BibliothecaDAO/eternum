import { useNetworkStatusStore } from "@/hooks/store/use-network-status-store";
import Button from "@/ui/design-system/atoms/button";
import { useDojo } from "@bibliothecadao/react";
import { env } from "../../../../env";

const isDebugEnabled = import.meta.env.DEV || env.VITE_PUBLIC_GRAPHICS_DEV === true;

export const NetworkDesyncDebugControls = () => {
  const forceDesync = useNetworkStatusStore((state) => state.forceDesync);
  const clearForcedDesync = useNetworkStatusStore((state) => state.clearForcedDesync);

  const {
    setup: {
      network: { provider },
    },
  } = useDojo();

  if (!isDebugEnabled) {
    return null;
  }

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-[1100] flex gap-2 rounded-md border border-white/10 bg-black/60 p-2 text-xs text-white shadow-lg">
      <Button size="xs" variant="secondary" onClick={() => provider.simulateHeartbeat()}>
        Mock heartbeat
      </Button>
      <Button size="xs" variant="secondary" onClick={() => forceDesync(20_000)}>
        Force desync
      </Button>
      <Button size="xs" variant="secondary" onClick={clearForcedDesync}>
        Clear
      </Button>
    </div>
  );
};
