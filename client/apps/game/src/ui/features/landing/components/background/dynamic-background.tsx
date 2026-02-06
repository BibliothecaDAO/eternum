import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type TransitionEvent, useCallback, useEffect, useRef, useState } from "react";

interface DynamicBackgroundProps {
  backgroundId: string;
  className?: string;
}

/**
 * A full-bleed background component with smooth crossfade transitions.
 * Uses the existing blitz cover images (01-08.png).
 */
export const DynamicBackground = ({ backgroundId, className }: DynamicBackgroundProps) => {
  const [currentBackground, setCurrentBackground] = useState(backgroundId);
  const [transitionBackground, setTransitionBackground] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Use refs to avoid setState warnings in effects
  const pendingTransitionRef = useRef<string | null>(null);
  const frameRef = useRef<number | null>(null);

  // Preload and setup transition when backgroundId changes
  useEffect(() => {
    if (backgroundId === currentBackground || backgroundId === transitionBackground) {
      return;
    }

    // Handle SSR case - setState in effect is intentional for async image preloading
    if (typeof Image === "undefined") {
      pendingTransitionRef.current = backgroundId;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR fallback case, no async op
      setTransitionBackground(backgroundId);
      return;
    }

    let isActive = true;
    const loader = new Image();
    loader.src = `/images/covers/blitz/${backgroundId}.png`;

    const handleReady = () => {
      if (!isActive) return;
      pendingTransitionRef.current = backgroundId;
      setTransitionBackground(backgroundId);
    };

    loader.addEventListener("load", handleReady);
    loader.addEventListener("error", handleReady);

    return () => {
      isActive = false;
      loader.removeEventListener("load", handleReady);
      loader.removeEventListener("error", handleReady);
    };
  }, [backgroundId, currentBackground, transitionBackground]);

  // Trigger transition animation using requestAnimationFrame
  useEffect(() => {
    if (!transitionBackground) return;

    // Reset transitioning state first to ensure CSS transition triggers properly
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Required for CSS transition reset
    setIsTransitioning(false);

    // Use double rAF for reliable CSS transition triggering
    const startTransition = () => {
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = window.requestAnimationFrame(() => {
          setIsTransitioning(true);
        });
      });
    };

    startTransition();

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [transitionBackground]);

  const handleTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLImageElement>) => {
      if (event.propertyName !== "opacity" || !transitionBackground) return;

      setCurrentBackground(transitionBackground);
      setTransitionBackground(null);
      setIsTransitioning(false);
      pendingTransitionRef.current = null;
    },
    [transitionBackground],
  );

  return (
    <div className={cn("absolute inset-0", className)}>
      {/* Base background layer */}
      <img
        alt=""
        aria-hidden="true"
        src={`/images/covers/blitz/${currentBackground}.png`}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Transition layer */}
      {transitionBackground && (
        <img
          alt=""
          aria-hidden="true"
          src={`/images/covers/blitz/${transitionBackground}.png`}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
            isTransitioning ? "opacity-100" : "opacity-0",
          )}
          onTransitionEnd={handleTransitionEnd}
        />
      )}

      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
    </div>
  );
};
