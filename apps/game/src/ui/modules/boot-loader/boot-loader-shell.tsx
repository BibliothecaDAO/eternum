import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudLoading, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import type { ReactNode } from "react";

import { ContourMap } from "./contour-map";

type BootLoaderShellProps = {
  className?: string;
  /** How far along, 0 to 100; without it the loader says it is working without a figure. */
  progress?: number;
  title?: string;
  subtitle?: string;
  caption?: string;
  detail?: ReactNode;
  showBackdrop?: boolean;
};

/**
 * What the screen shows while the world loads: the age's contour backdrop on the dark ground, and a sheet panel
 * saying what is happening, with its progress as a meter when it is known and the loading line when it is not.
 */
export const BootLoaderShell = ({
  className,
  progress,
  title,
  subtitle,
  caption,
  detail,
  showBackdrop = true,
}: BootLoaderShellProps) => (
  <div
    className={cn(
      "ui isolate z-hud-loading overflow-hidden bg-hud-dark",
      showBackdrop ? "fixed inset-0" : "absolute inset-0",
      className,
    )}
  >
    <ContourMap />
    <div className="relative flex min-h-full items-center justify-center px-6 py-10">
      <HudPanel collapsible={false} className="w-full max-w-lg">
        <div className="flex flex-col items-center gap-3 p-4 text-center">
          {caption && <span className="text-hud-label text-hud-muted">{caption}</span>}
          {title && <h2 className="text-hud-display text-hud-ink">{title}</h2>}
          {subtitle && <p className="text-hud-body text-hud-muted">{subtitle}</p>}
          {progress !== undefined && progress > 0 ? (
            <span className="w-full pt-2">
              <HudMeter share={Math.min(100, progress) / 100} label={title ?? "Loading"} />
            </span>
          ) : (
            <HudLoading line={caption ?? "Loading"} />
          )}
          {detail && <div className="w-full pt-3">{detail}</div>}
        </div>
      </HudPanel>
    </div>
  </div>
);
