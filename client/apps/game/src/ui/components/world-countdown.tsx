import { memo, useEffect, useState } from "react";

const formatCountdown = (secondsLeft: number): string => {
  const total = Math.max(0, Math.floor(secondsLeft));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
};

interface WorldCountdownProps {
  startMainAt: number | null;
  endAt: number | null;
  status: "checking" | "ok" | "fail";
  className?: string;
}

/**
 * Self-contained countdown component that manages its own timer.
 * This prevents parent component re-renders every second when displaying countdowns.
 */
export const WorldCountdown = memo(({ startMainAt, endAt, status, className }: WorldCountdownProps) => {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  // Only run the interval if we have timing data to display
  const needsTimer = startMainAt != null && status === "ok";

  useEffect(() => {
    if (!needsTimer) return;

    const id = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(id);
  }, [needsTimer]);

  // Compute the display label
  const label = (() => {
    if (startMainAt == null) {
      return status === "ok" ? "Not Configured" : "";
    }

    // Infinite game (endAt is 0 or null)
    if (endAt === 0 || endAt == null) {
      if (nowSec < startMainAt) {
        return `Starts in ${formatCountdown(startMainAt - nowSec)}`;
      }
      return "Ongoing";
    }

    // Normal game with end time
    if (nowSec < startMainAt) {
      return `Starts in ${formatCountdown(startMainAt - nowSec)}`;
    }
    if (nowSec < endAt) {
      return `${formatCountdown(endAt - nowSec)} left`;
    }
    return "Ended";
  })();

  if (!label) return null;

  return <span className={className}>{label}</span>;
});

WorldCountdown.displayName = "WorldCountdown";

/**
 * Extended version with more detailed formatting for the modal view.
 */
export const WorldCountdownDetailed = memo(({ startMainAt, endAt, status, className }: WorldCountdownProps) => {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  const needsTimer = startMainAt != null && status === "ok";

  useEffect(() => {
    if (!needsTimer) return;

    const id = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => window.clearInterval(id);
  }, [needsTimer]);

  const label = (() => {
    if (startMainAt == null) {
      return status === "ok" ? "Not Configured" : "";
    }

    // Infinite game
    if (endAt === 0 || endAt == null) {
      if (nowSec < startMainAt) {
        return `Starts in ${formatCountdown(startMainAt - nowSec)}`;
      }
      return "Ongoing — ∞";
    }

    // Normal game
    if (nowSec < startMainAt) {
      return `Starts in ${formatCountdown(startMainAt - nowSec)}`;
    }
    if (nowSec < endAt) {
      return `Ongoing — ${formatCountdown(endAt - nowSec)} left`;
    }
    return `Ended at ${new Date(endAt * 1000).toLocaleString()}`;
  })();

  if (!label) return null;

  return <span className={className}>{label}</span>;
});

WorldCountdownDetailed.displayName = "WorldCountdownDetailed";

/**
 * Hook to get current time and whether a game is ongoing.
 * Useful for filtering/sorting games by status.
 * Updates every 10 seconds to avoid excessive re-renders for filtering.
 */
export const useGameTimeStatus = () => {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    // Update less frequently since this is just for filtering, not display
    const id = window.setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 10000);

    return () => window.clearInterval(id);
  }, []);

  const isOngoing = (startMainAt: number | null, endAt: number | null) => {
    if (startMainAt == null) return false;
    if (nowSec < startMainAt) return false;
    if (endAt === 0 || endAt == null) return true;
    return nowSec < endAt;
  };

  const isEnded = (startMainAt: number | null, endAt: number | null) => {
    if (startMainAt == null) return false;
    if (endAt === 0 || endAt == null) return false;
    return nowSec >= endAt;
  };

  const isUpcoming = (startMainAt: number | null) => {
    if (startMainAt == null) return false;
    return nowSec < startMainAt;
  };

  return { nowSec, isOngoing, isEnded, isUpcoming };
};
