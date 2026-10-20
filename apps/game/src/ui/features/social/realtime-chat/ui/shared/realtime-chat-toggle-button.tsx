import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudButton, HudChip } from "@/ui/design-system/kit/hud-elements";

import { useCallback } from "react";
import {
  useRealtimeChatActions,
  useRealtimeChatSelector,
  useRealtimeConnection,
  useRealtimeTotals,
} from "../../hooks/use-realtime-chat";

/** How the chat's connection stands, as a dot in the sheet's tones: live, failed, or on its way. */
const connectionTone = {
  connected: "bg-hud-good animate-pulse",
  error: "bg-hud-bad",
  default: "bg-hud-neutral",
} as const;

/** Opens the chat, with its unread count and its connection's dot. */
export const RealtimeChatToggleButton = () => {
  const actions = useRealtimeChatActions();
  const isShellOpen = useRealtimeChatSelector((state) => state.isShellOpen);
  const { unreadDirectTotal, unreadWorldTotal } = useRealtimeTotals();
  const { connectionStatus } = useRealtimeConnection();

  const unreadTotal = unreadDirectTotal + unreadWorldTotal;

  const handleToggle = useCallback(() => {
    actions.setShellOpen(!isShellOpen);
  }, [actions, isShellOpen]);

  const indicatorClass =
    connectionStatus === "connected"
      ? connectionTone.connected
      : connectionStatus === "error"
        ? connectionTone.error
        : connectionTone.default;

  return (
    <span className="mb-3 mr-20 inline-flex">
      <HudButton kind="secondary" size="sm" onClick={handleToggle}>
        Open Chat
        {unreadTotal > 0 && <HudChip tone="bad">{unreadTotal}</HudChip>}
        <span className={cn("h-1.5 w-1.5 rounded-full", indicatorClass)} />
      </HudButton>
    </span>
  );
};
