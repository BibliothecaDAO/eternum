import { cn } from "@/ui/design-system/atoms/lib/utils";
import { QuickFeed } from "@/ui/features/event-feed/quick-feed";
import { type ReactNode, useCallback, useState } from "react";
import { HUD_COLUMN_TOP, HUD_COLUMN_WIDTH } from "./hud-layout";
import { HudChatWindow } from "./hud-chat-window";

type RightColumnFocus = "none" | "chat" | "log";

/** Feed at the top, tile details directly under it growing to their content, the chat strip anchored to the
 *  bottom. Open chat raises a fixed pane above the strip and the details scroll in what is left; the log takes
 *  the details' place while open. */
export const RightHudColumn = ({ children }: { children?: ReactNode }) => {
  const [focus, setFocus] = useState<RightColumnFocus>("none");
  const toggleLog = useCallback(() => setFocus((current) => (current === "log" ? "none" : "log")), []);
  const setChatOpen = useCallback((open: boolean) => setFocus(open ? "chat" : "none"), []);
  return (
    <aside
      aria-label="Right column"
      className={cn(
        "pointer-events-none fixed bottom-4 right-3 flex flex-col gap-2",
        focus === "chat" ? "z-[130]" : "z-30",
        HUD_COLUMN_TOP,
        HUD_COLUMN_WIDTH,
      )}
    >
      <QuickFeed logOpen={focus === "log"} onLogToggle={toggleLog} />
      {focus !== "log" && (
        <div
          aria-label={children ? "Tile details" : undefined}
          className="pointer-events-auto flex min-h-0 shrink flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gold/20"
        >
          {children}
        </div>
      )}
      <HudChatWindow open={focus === "chat"} onOpenChange={setChatOpen} />
    </aside>
  );
};
