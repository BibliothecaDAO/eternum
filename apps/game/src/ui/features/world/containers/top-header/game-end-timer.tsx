import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { resetBootstrap } from "@/init/bootstrap";
import Button from "@/ui/design-system/atoms/button";
import { HUD_BODY, HUD_HEADLINE } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { Popover } from "@/ui/design-system/molecules/popover";
import { hasFiniteSeasonEnd } from "@/ui/features/world/utils/season-timing";
import Clock from "lucide-react/dist/esm/icons/clock";
import TrophyIcon from "lucide-react/dist/esm/icons/trophy";
import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { TOP_PILL, TOP_PILL_TEXT } from "./top-pill";

const GAME_FINISHED_POPOVER_ID = "game-finished";

/**
 * The finished-game surface: a pill where the timer was, with the review and the dashboard one popover away. The
 * map stays reachable — a finished game is still worth looking at.
 */
const GameFinishedPill = () => {
  const isOpen = usePopoverStore((state) => state.openId === GAME_FINISHED_POPOVER_ID);
  const togglePopover = usePopoverStore((state) => state.toggle);
  const navigate = useNavigate();
  const goToReview = useCallback(() => {
    resetBootstrap();
    navigate("/");
  }, [navigate]);

  return (
    <Popover
      id={GAME_FINISHED_POPOVER_ID}
      ariaLabel="Game finished"
      trigger={
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => togglePopover(GAME_FINISHED_POPOVER_ID)}
          className={cn(
            TOP_PILL,
            TOP_PILL_TEXT,
            "game-finished-pill whitespace-nowrap transition hover:bg-gold/15",
            isOpen && "border-gold/60 bg-gold/15",
          )}
        >
          <TrophyIcon className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
          <span>Game finished</span>
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <span className={HUD_HEADLINE}>This game has ended</span>
        <span className={HUD_BODY}>
          The review, standings and rewards are on the dashboard. The map stays open here.
        </span>
        <Button variant="gold" size="xs" className="w-full justify-center" onClick={goToReview}>
          Go to the review
        </Button>
      </div>
    </Popover>
  );
};

const DEBUG_URGENCY_MODE = false; // Flip to true and tweak the value below to preview urgency states quickly.
const DEBUG_SECONDS_REMAINING = 25;

const SCREEN_BORDER_CLASSES = ["urgency-border-warning", "urgency-border-critical", "urgency-border-final"] as const;

const URGENCY_THRESHOLD_SECONDS = 5 * 60;
const CRITICAL_THRESHOLD_SECONDS = 2 * 60;
const FINAL_THRESHOLD_SECONDS = 30;

type UrgencyState = "default" | "warning" | "critical" | "final";

const getSecondsRemaining = (gameEndAt: number | null, currentBlockTimestamp: number) => {
  if (!hasFiniteSeasonEnd(gameEndAt)) {
    return 0;
  }

  return Math.max(0, gameEndAt - currentBlockTimestamp);
};

export const GameEndTimer = memo(() => {
  const gameEndAt = useUIStore((state) => state.gameEndAt);
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const currentBlockTimestamp = useCurrentBlockTimestamp();
  const hasFiniteGameEnd = useMemo(() => hasFiniteSeasonEnd(gameEndAt), [gameEndAt]);

  const secondsRemaining = getSecondsRemaining(gameEndAt, currentBlockTimestamp);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  useEffect(() => {
    if (!isTooltipVisible) return;

    if (!hasFiniteGameEnd) {
      setTooltip({
        position: "bottom",
        content: (
          <div className="whitespace-nowrap pointer-events-none flex flex-col mt-3 mb-3 text-sm capitalize">
            <div className="font-bold">Game Duration:</div>
            <div>Infinite</div>
          </div>
        ),
      });
      return;
    }

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
  }, [hasFiniteGameEnd, isTooltipVisible, secondsRemaining, setTooltip]);

  const secondsForDisplay = useMemo(() => {
    if (!hasFiniteGameEnd) {
      return 0;
    }

    return Math.max(0, DEBUG_URGENCY_MODE ? DEBUG_SECONDS_REMAINING : secondsRemaining);
  }, [hasFiniteGameEnd, secondsRemaining]);

  const hasGameEnded = useMemo(() => {
    if (!hasFiniteGameEnd || gameEndAt == null) return false;
    if (DEBUG_URGENCY_MODE) return false;

    return currentBlockTimestamp >= gameEndAt || secondsForDisplay <= 0;
  }, [currentBlockTimestamp, gameEndAt, hasFiniteGameEnd, secondsForDisplay]);

  const { hours, minutes } = useMemo(() => {
    const hrs = Math.floor(secondsForDisplay / 3600);
    const mins = Math.floor((secondsForDisplay % 3600) / 60);
    return { hours: hrs, minutes: mins };
  }, [secondsForDisplay]);

  const timeDisplay = useMemo(
    () => (hasFiniteGameEnd ? `${hours}h ${minutes.toString().padStart(2, "0")}m` : "Infinite"),
    [hasFiniteGameEnd, hours, minutes],
  );

  const urgencyState = useMemo<UrgencyState>(() => {
    if (!hasFiniteGameEnd) return "default";
    if (hasGameEnded) return "default";
    if (secondsForDisplay <= FINAL_THRESHOLD_SECONDS) return "final";
    if (secondsForDisplay <= CRITICAL_THRESHOLD_SECONDS) return "critical";
    if (secondsForDisplay <= URGENCY_THRESHOLD_SECONDS) return "warning";
    return "default";
  }, [hasFiniteGameEnd, hasGameEnded, secondsForDisplay]);

  const containerToneClass = useMemo(() => {
    switch (urgencyState) {
      case "warning":
        return "bg-progress-bar-medium/20 border-progress-bar-medium text-progress-bar-medium shadow-[0_0_12px_rgba(245,158,11,0.35)]";
      case "critical":
        return "bg-progress-bar-danger/25 border-progress-bar-danger text-progress-bar-danger shadow-[0_0_16px_rgba(239,68,68,0.45)]";
      case "final":
        return "bg-danger/30 border-danger text-danger shadow-[0_0_20px_rgba(200,68,68,0.55)]";
      default:
        // Empty string → the wrapper falls back to OVERLAY_SURFACE_BASE so the
        // pill matches every other top-bar pill in its default state.
        return "";
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

  const showRing = !hasGameEnded && urgencyState !== "default";
  const ringRadius = 14;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const progressRatio = showRing
    ? Math.min(secondsForDisplay, URGENCY_THRESHOLD_SECONDS) / URGENCY_THRESHOLD_SECONDS
    : 1;
  const ringDashOffset = ringCircumference * (1 - progressRatio);

  // Fix build issue: urgencyState === "default" is always false for type narrowing (see TS error).
  // Instead, use showRing for conditional logic, since showRing is false when urgencyState is "default".
  const ringColor = useMemo(() => {
    if (!showRing) return "#dfaa54"; // gold
    if (secondsForDisplay <= 10) return "#FAFF00"; // yellow pop
    if (urgencyState === "final") return "#EF5858"; // light-red
    if (urgencyState === "critical") return "#C84444"; // danger
    return "#f59e0b"; // progress-bar-medium
  }, [secondsForDisplay, showRing, urgencyState]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!body) return;

    const activeClass = urgencyState === "default" ? null : `urgency-border-${urgencyState}`;

    SCREEN_BORDER_CLASSES.forEach((className) => {
      body.classList.remove(className);
    });

    if (activeClass) {
      body.classList.add(activeClass);
    }

    return () => {
      if (activeClass) {
        body.classList.remove(activeClass);
      }
    };
  }, [urgencyState]);

  const handleMouseEnter = useCallback(() => {
    setIsTooltipVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsTooltipVisible(false);
    setTooltip(null);
  }, [setTooltip]);

  // Self-gate: an infinite game has no timer to show; a finished one shows the finished pill in its place.
  if (!hasFiniteGameEnd) {
    return null;
  }
  if (hasGameEnded) {
    return <GameFinishedPill />;
  }

  const isDefaultTone = urgencyState === "default";

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="pointer-events-auto">
      <div
        className={`relative flex h-9 items-center gap-2 rounded-full px-3.5 transition-all duration-300 ${
          isDefaultTone ? OVERLAY_SURFACE_BASE : `border backdrop-blur-sm ${containerToneClass}`
        }`}
        style={dynamicStyle}
      >
        <div className="relative flex h-5 w-5 items-center justify-center">
          {showRing && (
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 32 32">
              <circle
                className="opacity-30"
                stroke={!showRing ? "#312E20" : "currentColor"}
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
                  filter: showRing ? "drop-shadow(0 0 6px rgba(255,255,255,0.45))" : undefined,
                }}
              />
            </svg>
          )}
          <Clock className="h-3.5 w-3.5" />
        </div>
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.16em] tabular-nums ${
            isDefaultTone ? "text-gold" : ""
          }`}
        >
          {timeDisplay}
        </span>
      </div>
    </div>
  );
});

GameEndTimer.displayName = "GameEndTimer";
