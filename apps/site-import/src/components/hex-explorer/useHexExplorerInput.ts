import { useEffect, useRef } from "react";
import type { HexDirection } from "./types";

/**
 * Custom hook for keyboard and touch input mapped to hex directions.
 *
 * Key mapping (4-direction, pointy-top hex):
 *   ArrowRight → 0 (East)
 *   ArrowUp    → 1 (NE)
 *   ArrowLeft  → 3 (West)
 *   ArrowDown  → 4 (SW)
 *
 * Touch: swipe direction snapped to nearest of 4 hex directions.
 */
export function useHexExplorerInput(
  isActive: boolean,
  onMove: (direction: HexDirection) => void
): void {
  const lastMoveTime = useRef(0);
  const THROTTLE_MS = 180;

  // ── Keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    function handleKeyDown(e: KeyboardEvent) {
      let dir: HexDirection;

      switch (e.key) {
        case "ArrowRight":
          dir = 0;
          break;
        case "ArrowUp":
          dir = 1;
          break;
        case "ArrowLeft":
          dir = 3;
          break;
        case "ArrowDown":
          dir = 4;
          break;
        default:
          return;
      }

      // Prevent page scroll while explorer is active
      e.preventDefault();

      const now = performance.now();
      if (now - lastMoveTime.current < THROTTLE_MS) return;
      lastMoveTime.current = now;

      onMove(dir);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onMove]);

  // ── Touch / swipe ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    let touchStartX = 0;
    let touchStartY = 0;

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Minimum swipe distance
      if (dist < 30) return;

      const now = performance.now();
      if (now - lastMoveTime.current < THROTTLE_MS) return;
      lastMoveTime.current = now;

      // Calculate angle and snap to nearest hex direction
      const angle = Math.atan2(dy, dx); // radians, 0 = right

      // Map angle to 4 hex directions:
      // Right (-45 to 45) → East (0)
      // Up (-135 to -45) → NE (1)
      // Left (135 to -135) → West (3)
      // Down (45 to 135) → SW (4)
      let dir: HexDirection;
      if (angle > -Math.PI / 4 && angle <= Math.PI / 4) {
        dir = 0; // East
      } else if (angle > -3 * Math.PI / 4 && angle <= -Math.PI / 4) {
        dir = 1; // NE (up)
      } else if (angle > Math.PI / 4 && angle <= 3 * Math.PI / 4) {
        dir = 4; // SW (down)
      } else {
        dir = 3; // West
      }

      onMove(dir);
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isActive, onMove]);
}
