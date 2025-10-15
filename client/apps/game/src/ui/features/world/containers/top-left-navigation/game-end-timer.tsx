import { useUIStore } from "@/hooks/store/use-ui-store";
import { getBlockTimestamp } from "@bibliothecadao/eternum";
import { Clock } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

const DEBUG_URGENCY_MODE = false; // Flip to true and tweak the value below to preview urgency states quickly.
const DEBUG_SECONDS_REMAINING = 150;

const URGENCY_THRESHOLD_SECONDS = 5 * 60;
const CRITICAL_THRESHOLD_SECONDS = 2 * 60;
const FINAL_THRESHOLD_SECONDS = 30;

type UrgencyState = "default" | "warning" | "critical" | "final";

export const GameEndTimer = memo(() => {
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const { currentBlockTimestamp } = getBlockTimestamp();

  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.max(0, gameEndAt ? gameEndAt - currentBlockTimestamp : 0),
  );
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  useEffect(() => {
    if (!gameEndAt) {
      setSecondsRemaining(0);
      return;
    }

    const nextRemaining = Math.max(gameEndAt - currentBlockTimestamp, 0);
    setSecondsRemaining((previous) => (previous === nextRemaining ? previous : nextRemaining));
  }, [currentBlockTimestamp, gameEndAt]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 0 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isTooltipVisible) return;

    const calculateDisplaySeconds = () => Math.max(0, DEBUG_URGENCY_MODE ? DEBUG_SECONDS_REMAINING : secondsRemaining);

    const updateTooltip = () => {
      const displaySeconds = calculateDisplaySeconds();
      const hours = Math.floor(displaySeconds / 3600);
      const minutes = Math.floor((displaySeconds % 3600) / 60);
      const seconds = displaySeconds % 60;

      setTooltip({
        position: "bottom",
        content: (
          <div className="whitespace-nowrap pointer-events-none flex flex-col mt-3 mb-3 text-sm capitalize">
            <div className="font-bold">Game Ends In:</div>
            <div>
              <span>{`${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`}</span>
            </div>
          </div>
        ),
      });
    };

    updateTooltip();
    const tooltipTimer = setInterval(updateTooltip, 1000);

    return () => clearInterval(tooltipTimer);
  }, [isTooltipVisible, secondsRemaining, setTooltip]);

  const secondsForDisplay = useMemo(
    () => Math.max(0, DEBUG_URGENCY_MODE ? DEBUG_SECONDS_REMAINING : secondsRemaining),
    [secondsRemaining],
  );

  const { hours, minutes } = useMemo(() => {
    const hrs = Math.floor(secondsForDisplay / 3600);
    const mins = Math.floor((secondsForDisplay % 3600) / 60);
    return { hours: hrs, minutes: mins };
  }, [secondsForDisplay]);

  const timeDisplay = useMemo(() => `${hours}h ${minutes.toString().padStart(2, "0")}m`, [hours, minutes]);

  const urgencyState = useMemo<UrgencyState>(() => {
    if (secondsForDisplay <= FINAL_THRESHOLD_SECONDS) return "final";
    if (secondsForDisplay <= CRITICAL_THRESHOLD_SECONDS) return "critical";
    if (secondsForDisplay <= URGENCY_THRESHOLD_SECONDS) return "warning";
    return "default";
  }, [secondsForDisplay]);

  const containerToneClass = useMemo(() => {
    switch (urgencyState) {
      case "warning":
        return "bg-progress-bar-medium/20 border-progress-bar-medium text-progress-bar-medium shadow-[0_0_12px_rgba(245,158,11,0.35)]";
      case "critical":
        return "bg-progress-bar-danger/25 border-progress-bar-danger text-progress-bar-danger shadow-[0_0_16px_rgba(239,68,68,0.45)]";
      case "final":
        return "bg-danger/30 border-danger text-danger shadow-[0_0_20px_rgba(200,68,68,0.55)]";
      default:
        return "bg-brown/80 border-gold/30 text-gold shadow-none";
    }
  }, [urgencyState]);

  const dynamicStyle = useMemo<CSSProperties | undefined>(() => {
    if (urgencyState === "default") return undefined;

    const duration = urgencyState === "warning" ? 1.2 : urgencyState === "critical" ? 0.8 : 0.4;

    const scale = urgencyState === "final" ? 1.1 : urgencyState === "critical" ? 1.05 : 1;

    const style: CSSProperties = {
      animation: `pulse ${duration}s ease-in-out infinite`,
    };

    if (scale !== 1) {
      style.transform = `scale(${scale})`;
    }

    return style;
  }, [urgencyState]);

  const showRing = urgencyState !== "default";
  const ringRadius = 14;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const progressRatio = showRing
    ? Math.min(secondsForDisplay, URGENCY_THRESHOLD_SECONDS) / URGENCY_THRESHOLD_SECONDS
    : 1;
  const ringDashOffset = ringCircumference * (1 - progressRatio);

  const ringColor = useMemo(() => {
    if (!showRing) return "#dfaa54"; // gold
    if (secondsForDisplay <= 10) return "#FAFF00"; // yellow pop
    if (urgencyState === "final") return "#EF5858"; // light-red
    if (urgencyState === "critical") return "#C84444"; // danger
    return "#f59e0b"; // progress-bar-medium
  }, [secondsForDisplay, showRing, urgencyState]);

  const handleMouseEnter = useCallback(() => {
    setIsTooltipVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsTooltipVisible(false);
    setTooltip(null);
  }, [setTooltip]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="self-center text-center px-2 py-1 flex gap-2 items-center border-l border-gold/20"
    >
      <div
        className={`relative flex items-center gap-2 px-2 py-1 rounded border transition-all duration-300 ${containerToneClass}`}
        style={dynamicStyle}
      >
        <div className="relative flex h-6 w-6 items-center justify-center">
          {showRing && (
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 32 32">
              <circle
                className="opacity-30"
                stroke={urgencyState === "default" ? "#312E20" : "currentColor"}
                strokeWidth="3"
                fill="none"
                cx="16"
                cy="16"
                r={ringRadius}
              />
              <circle
                stroke={ringColor}
                strokeWidth="3"
                fill="none"
                cx="16"
                cy="16"
                r={ringRadius}
                strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                strokeDashoffset={ringDashOffset}
                strokeLinecap="round"
                className="transition-all duration-500"
                style={{
                  filter: urgencyState !== "default" ? "drop-shadow(0 0 6px rgba(255,255,255,0.45))" : undefined,
                }}
              />
            </svg>
          )}
          <Clock className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold font-mono tracking-wide">{timeDisplay}</span>
      </div>
    </div>
  );
});

GameEndTimer.displayName = "GameEndTimer";
