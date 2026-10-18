import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import CircleButton from "@/ui/design-system/molecules/circle-button";

import { useCallback, useMemo } from "react";
import {
  useRealtimeChatActions,
  useRealtimeChatSelector,
  useRealtimeConnection,
  useRealtimeTotals,
} from "../../hooks/use-realtime-chat";

type RealtimeChatToggleButtonProps = {
  className?: string;
  variant?: "inline" | "menu";
};

const connectionTone = {
  connected: "bg-emerald-400 animate-pulse",
  error: "bg-red-400",
  default: "bg-neutral-500",
} as const;

export const RealtimeChatToggleButton = ({ className, variant = "inline" }: RealtimeChatToggleButtonProps) => {
  const actions = useRealtimeChatActions();
  const isShellOpen = useRealtimeChatSelector((state) => state.isShellOpen);
  const { unreadDirectTotal, unreadWorldTotal } = useRealtimeTotals();
  const { connectionStatus } = useRealtimeConnection();

  const unreadTotal = unreadDirectTotal + unreadWorldTotal;

  const handleToggle = useCallback(() => {
    actions.setShellOpen(!isShellOpen);
  }, [actions, isShellOpen]);

  const indicatorClass = useMemo(() => {
    if (connectionStatus === "connected") {
      return connectionTone.connected;
    }
    if (connectionStatus === "error") {
      return connectionTone.error;
    }
    return connectionTone.default;
  }, [connectionStatus]);

  if (variant === "menu") {
    return (
      <CircleButton
        onClick={handleToggle}
        size="md"
        tooltipLocation="bottom"
        active={isShellOpen}
        label="Chat"
        className={cn("chat-toggle-button border-none", className)}
        primaryNotification={
          unreadTotal > 0
            ? {
                value: unreadTotal,
                color: "red",
                location: "topright",
              }
            : undefined
        }
      >
        <div className="relative flex h-full w-full items-center justify-center">
          <SemanticIcon name="chat" className="h-4 w-4 md:h-5 md:w-5" style={{ color: "#996929" }} />
          <span className={cn("absolute bottom-1 right-1 h-2 w-2 rounded-full", indicatorClass)} />
        </div>
      </CircleButton>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 mr-20 mb-3 transition text-hud-muted hover:text-hud-accent border border-hud-line hover:border-hud-line-strong bg-hud-well hover:bg-hud-well rounded text-hud-label shadow-inner shadow-black/30",
        className,
      )}
    >
      <span className="">Open Chat</span>
      {unreadTotal > 0 && (
        <span className="bg-red/40 text-hud-ink text-hud-label px-1.5 py-0.5 rounded-full">{unreadTotal}</span>
      )}
      <span className={cn("h-1.5 w-1.5 rounded-full", indicatorClass)} />
    </button>
  );
};
