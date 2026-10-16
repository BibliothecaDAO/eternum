import clsx from "clsx";
import type { ReactNode } from "react";

import { ContourMap } from "./contour-map";
import { SegmentedBracketLoader, type LoaderProgressMode } from "./segmented-bracket-loader";

type BootLoaderShellProps = {
  className?: string;
  panelClassName?: string;
  mode?: LoaderProgressMode;
  progress?: number;
  segments?: number;
  title?: string;
  subtitle?: string;
  caption?: string;
  detail?: ReactNode;
  showBackdrop?: boolean;
};

export const BootLoaderShell = ({
  className,
  panelClassName,
  mode = "indeterminate",
  progress = 0,
  segments = 8,
  title,
  subtitle,
  caption,
  detail,
  showBackdrop = true,
}: BootLoaderShellProps) => {
  return (
    <div
      className={clsx(
        "boot-loader-surface z-[110] isolate overflow-hidden text-gold",
        showBackdrop ? "fixed inset-0 bg-black/95" : "absolute inset-0 bg-black/90",
        className,
      )}
    >
      <ContourMap />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,169,96,0.08),transparent_54%)]" />
      <div className="relative z-10 flex min-h-full items-center justify-center px-6 py-10">
        <div
          className={clsx(
            "w-full max-w-[34rem] rounded-2xl border border-gold/20 bg-[rgba(7,10,12,0.75)] px-6 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_1px_rgba(201,169,96,0.15)]",
            panelClassName,
          )}
        >
          {caption ? <div className="mb-2 text-sm text-kit-muted sm:text-sm">{caption}</div> : null}
          {title ? <h2 className="text-lg font-semibold text-gold/90 sm:text-xl">{title}</h2> : null}
          {subtitle ? (
            <p className="mx-auto mt-3 max-w-[28rem] text-sm text-[rgba(236,224,194,0.72)] sm:text-base">{subtitle}</p>
          ) : null}

          <SegmentedBracketLoader className="mt-6" mode={mode} progress={progress} segments={segments} />

          {detail ? <div className="mt-6">{detail}</div> : null}
        </div>
      </div>
    </div>
  );
};
