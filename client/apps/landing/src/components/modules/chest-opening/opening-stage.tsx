import gsap from "gsap";
import { useCallback, useEffect, useRef } from "react";
import { ChestStageContainer } from "./chest-stage-container";

// Video imports - high resolution
import chestOpeningCommon from "@videos/chest-opening/high-res/common.mp4";
import chestOpeningEpic from "@videos/chest-opening/high-res/epic.mp4";
import chestOpeningLegendary from "@videos/chest-opening/high-res/legendary.mp4";
import chestOpeningRare from "@videos/chest-opening/high-res/rare.mp4";
import chestOpeningUncommon from "@videos/chest-opening/high-res/uncommon.mp4";

// Video imports - low resolution (for mobile)
import chestOpeningCommonLowRes from "@videos/chest-opening/low-res/common.mov";
import chestOpeningEpicLowRes from "@videos/chest-opening/low-res/epic.mov";
import chestOpeningLegendaryLowRes from "@videos/chest-opening/low-res/legendary.mov";
import chestOpeningRareLowRes from "@videos/chest-opening/low-res/rare.mov";
import chestOpeningUncommonLowRes from "@videos/chest-opening/low-res/uncommon.mov";

const chestOpeningVideoHighRes: Record<string, string> = {
  common: chestOpeningCommon,
  uncommon: chestOpeningUncommon,
  rare: chestOpeningRare,
  epic: chestOpeningEpic,
  legendary: chestOpeningLegendary,
};

const chestOpeningVideoLowRes: Record<string, string> = {
  common: chestOpeningCommonLowRes,
  uncommon: chestOpeningUncommonLowRes,
  rare: chestOpeningRareLowRes,
  epic: chestOpeningEpicLowRes,
  legendary: chestOpeningLegendaryLowRes,
};

/**
 * Get the appropriate chest opening video based on rarity and device type.
 * Exported for use by parent components.
 */
export function getChestOpeningVideo(chestType: string, isMobile: boolean): string {
  return isMobile ? chestOpeningVideoLowRes[chestType] : chestOpeningVideoHighRes[chestType];
}

interface OpeningStageProps {
  /** Whether the stage should be visible and playing */
  active: boolean;
  /** Pre-selected video URL based on rarity */
  videoSrc: string;
  /** Called when video + exit animation completes */
  onComplete: () => void;
  /** Optional skip handler */
  onSkip?: () => void;
}

/**
 * OpeningStage - Video stage for chest opening animation with sound.
 *
 * Responsibilities:
 * - Display chest opening video with audio
 * - Animate stage entrance/exit with GSAP
 * - Signal completion to parent for transition to RevealStage
 *
 * Does NOT handle:
 * - Blockchain transaction waiting (PendingOverlay)
 * - Item reveals (RevealStage)
 */
export function OpeningStage({ active, videoSrc, onComplete, onSkip }: OpeningStageProps) {
  // Refs for DOM elements and timeline
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const hasStartedRef = useRef(false);

  // Stable callback ref to avoid re-triggering effects
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Handle skip action
  const handleSkip = useCallback(() => {
    // Kill any running timeline
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
    }

    // Stop video
    if (videoRef.current) {
      videoRef.current.pause();
    }

    // Call skip handler
    onSkip?.();
  }, [onSkip]);

  // Main effect: create and run GSAP timeline when active
  useEffect(() => {
    if (!active) return;
    if (!containerRef.current || !videoRef.current) return;

    // Skip if already started (prevents double-play)
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const container = containerRef.current;
    const video = videoRef.current;

    // Kill any existing timeline first
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
    }

    // Set initial state immediately (before any animation)
    gsap.set(container, { opacity: 0, scale: 0.95 });

    // Create the timeline
    const tl = gsap.timeline({
      onComplete: () => {
        onCompleteRef.current();
      },
    });

    timelineRef.current = tl;

    // Phase 1: Enter animation (fade + scale in)
    tl.to(container, {
      opacity: 1,
      scale: 1,
      duration: 0.4,
      ease: "power2.out",
    });

    // Phase 2: Play video after enter completes
    tl.call(() => {
      video.play().catch(() => {
        // If autoplay is blocked, skip to completion after a delay
        console.warn("Video autoplay blocked, will auto-advance in 2s");
        setTimeout(() => {
          if (timelineRef.current) {
            timelineRef.current.play();
          }
        }, 2000);
      });
    });

    // Phase 3: Wait for video to end, then exit
    // We'll pause here and resume when video ends
    tl.addPause();

    // Phase 4: Exit animation (fade + slight scale up)
    tl.to(container, {
      opacity: 0,
      scale: 1.02,
      duration: 0.3,
      ease: "power2.in",
    });

    // Video ended handler - resume timeline for exit animation
    const handleVideoEnded = () => {
      if (timelineRef.current) {
        timelineRef.current.play();
      }
    };

    video.addEventListener("ended", handleVideoEnded);

    // Cleanup
    return () => {
      video.removeEventListener("ended", handleVideoEnded);
      video.pause();
      video.currentTime = 0;
      hasStartedRef.current = false;

      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Don't render if not active
  if (!active) return null;

  return (
    <ChestStageContainer>
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center"
        style={{ willChange: "transform, opacity" }}
      >
        {/* Video element - fills container, cropped to fit */}
        <video
          ref={videoRef}
          src={videoSrc}
          playsInline
          preload="auto"
          className="w-full h-full object-cover"
        />

        {/* Skip button */}
        {onSkip && (
          <button
            onClick={handleSkip}
            className="absolute bottom-6 right-6 px-4 py-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/70 hover:text-white transition-colors text-sm"
          >
            Skip
          </button>
        )}
      </div>
    </ChestStageContainer>
  );
}
