import type { CompactLane } from "@/hooks/helpers/use-compact-hud";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { ReactNode } from "react";

interface HudHeaderLayoutProps {
  lane: CompactLane | null;
  identity: ReactNode;
  clock: ReactNode;
  viewControls: ReactNode;
  attention: ReactNode;
  settings: ReactNode;
}

/** Small screens keep the status row visible and move map controls below it, never into a horizontal scroller. */
export function HudHeaderLayout({ lane, identity, clock, viewControls, attention, settings }: HudHeaderLayoutProps) {
  if (lane === null) {
    return (
      <header
        aria-label="Game controls"
        className="pointer-events-none fixed inset-x-0 top-0 z-20 flex h-11 items-center justify-center gap-2 px-3"
      >
        {identity}
        {viewControls}
        {clock}
        {attention}
        {settings}
      </header>
    );
  }

  return (
    <header
      aria-label="Game controls"
      className={cn(
        "pointer-events-none fixed inset-x-0 z-20 flex gap-1.5",
        lane === "portrait" ? "flex-col" : "items-start",
      )}
      style={{
        top: "max(0.5rem, env(safe-area-inset-top))",
        paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div className="min-w-0 flex-1 [&>span]:max-w-full">{identity}</div>
        <div className="shrink-0">{clock}</div>
        <div className="shrink-0">{settings}</div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-1.5">
        {viewControls}
        {attention}
      </div>
    </header>
  );
}
