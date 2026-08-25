import clsx from "clsx";
import React from "react";

interface ViewToggleProps {
  useNewVersion: boolean;
  onToggle: (useNew: boolean) => void;
  showAnimation?: boolean;
  variant?: "compact" | "full";
}

export const ViewToggle = React.memo(
  ({ useNewVersion, onToggle, showAnimation = false, variant = "full" }: ViewToggleProps) => {
    const isCompact = variant === "compact";

    return (
      <label
        className={clsx(
          "inline-flex items-center gap-2 cursor-pointer relative",
          isCompact
            ? showAnimation && "animate-pulse"
            : clsx(
                "rounded-full border px-3 py-1 text-[11px]",
                showAnimation
                  ? "border-gold/60 bg-gradient-to-r from-gold/20 to-gold/10 animate-pulse shadow-lg shadow-gold/20"
                  : "border-gold/20 bg-gold/5 text-gold/70",
              ),
        )}
      >
        {showAnimation && (
          <span
            className={clsx(
              "absolute rounded-full bg-gradient-to-r from-gold/40 via-gold/60 to-gold/40 animate-ping opacity-75",
              isCompact ? "-inset-1" : "-inset-0.5",
            )}
          />
        )}
        <span
          className={clsx(
            "relative",
            isCompact ? "text-xxs" : "",
            !useNewVersion && (isCompact ? "text-gold/50" : "text-gold/50"),
            showAnimation && "font-semibold text-gold",
            isCompact && `mr-2`,
          )}
        >
          Single Realm View
        </span>
        <div className={clsx("relative", showAnimation && "scale-110 transition-transform")}>
          <input
            type="checkbox"
            className="peer sr-only"
            checked={useNewVersion}
            onChange={() => onToggle(!useNewVersion)}
          />
          <div
            className={clsx(
              "rounded-full transition peer-checked:bg-gold/30",
              isCompact ? "w-9 h-5" : "h-5 w-9",
              showAnimation ? "bg-gradient-to-r from-gold/60 to-gold/40" : "bg-brown/50",
            )}
          >
            <div
              className={clsx(
                "absolute top-[2px] left-[2px] rounded-full transition",
                isCompact ? "h-4 w-4 peer-checked:translate-x-full" : "h-4 w-4 peer-checked:translate-x-4",
                showAnimation ? "bg-white shadow-lg shadow-gold/50" : "bg-gold",
              )}
            />
          </div>
        </div>
        <span
          className={clsx(
            "relative",
            isCompact ? "text-xxs ml-2" : "",
            useNewVersion && "text-gold",
            !useNewVersion && !isCompact && "text-gold/50",
            showAnimation && "font-semibold text-gold",
          )}
        >
          All Realms View
        </span>
      </label>
    );
  },
);
