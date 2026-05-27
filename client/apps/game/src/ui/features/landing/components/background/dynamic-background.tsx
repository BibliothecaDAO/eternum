import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type TransitionEvent, useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_BACKGROUND_ID = "02";
const OPTIMIZED_BACKGROUND_IDS = new Set(["02", "07"]);

interface DynamicBackgroundProps {
  backgroundId: string;
  className?: string;
}

/**
 * A full-bleed background component with smooth crossfade transitions.
 * Uses optimized dashboard WebP assets with PNG fallbacks for older browsers.
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
    loader.src = resolveLandingBackgroundSources(backgroundId).webp;

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
    (event: TransitionEvent<HTMLElement>) => {
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
      <LandingBackgroundImage backgroundId={currentBackground} />

      {/* Transition layer */}
      {transitionBackground && (
        <LandingBackgroundImage
          backgroundId={transitionBackground}
          className={cn("transition-opacity duration-700", isTransitioning ? "opacity-100" : "opacity-0")}
          onTransitionEnd={handleTransitionEnd}
        />
      )}

      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
    </div>
  );
};

const LandingBackgroundImage = ({
  backgroundId,
  className,
  onTransitionEnd,
}: {
  backgroundId: string;
  className?: string;
  onTransitionEnd?: (event: TransitionEvent<HTMLElement>) => void;
}) => {
  const sources = resolveLandingBackgroundSources(backgroundId);

  return (
    <picture
      aria-hidden="true"
      className={cn("absolute inset-0 block h-full w-full", className)}
      onTransitionEnd={onTransitionEnd}
    >
      <source srcSet={sources.webp} type="image/webp" />
      <img alt="" src={sources.png} className="h-full w-full object-cover" />
    </picture>
  );
};

const resolveLandingBackgroundSources = (backgroundId: string) => {
  const resolvedBackgroundId = OPTIMIZED_BACKGROUND_IDS.has(backgroundId) ? backgroundId : DEFAULT_BACKGROUND_ID;

  return {
    webp: `/images/covers/dashboard/${resolvedBackgroundId}.webp`,
    png: `/images/covers/blitz/${resolvedBackgroundId}.png`,
  };
};
