import type { CompactLane } from "@/hooks/helpers/use-compact-hud";
import type { ReactNode } from "react";

interface HudHeaderLayoutProps {
  lane: CompactLane | null;
  identity: ReactNode;
  clock: ReactNode;
  viewControls: ReactNode;
  attention: ReactNode;
  settings: ReactNode;
}

/** Small screens keep status and navigation in two bounded rows, never in a horizontal scroller. */
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

  if (lane === "portrait") {
    return (
      <header
        aria-label="Game controls"
        className="pointer-events-none fixed inset-x-0 z-20 flex flex-col gap-1.5"
        style={{
          top: "max(0.5rem, env(safe-area-inset-top))",
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        <div
          aria-label="Game status"
          className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5"
        >
          <div className="min-w-0 overflow-hidden [&>span]:max-w-full">{identity}</div>
          <div className="shrink-0">{clock}</div>
          <div className="shrink-0">{settings}</div>
        </div>
        <div aria-label="Map navigation" className="flex w-full min-w-0 items-center justify-between gap-1.5">
          <div className="min-w-0">{viewControls}</div>
          <div className="shrink-0">{attention}</div>
        </div>
      </header>
    );
  }

  return (
    <header
      aria-label="Game controls"
      className="pointer-events-none fixed inset-x-0 z-20 flex items-start gap-1.5"
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
