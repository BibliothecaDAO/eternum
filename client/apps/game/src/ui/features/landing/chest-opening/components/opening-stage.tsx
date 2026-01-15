import gsap from "gsap";
import { useCallback, useEffect, useRef } from "react";
import { ChestStageContainer } from "./chest-stage-container";

// Video paths - using public folder structure
const getVideoPath = (epoch: string, rarity: string) =>
  `/videos/chest-opening/${epoch}/${rarity}.mp4`;

const chestOpeningVideoEternumRewardsS1: Record<string, string> = {
  common: getVideoPath("eternum-rewards-s1", "common"),
  uncommon: getVideoPath("eternum-rewards-s1", "uncommon"),
  rare: getVideoPath("eternum-rewards-s1", "rare"),
  epic: getVideoPath("eternum-rewards-s1", "epic"),
  legendary: getVideoPath("eternum-rewards-s1", "legendary"),
};

const chestOpeningVideoBlitzRewardsS0: Record<string, string> = {
  rare: getVideoPath("blitz-rewards-s0", "rare"),
  epic: getVideoPath("blitz-rewards-s0", "epic"),
  legendary: getVideoPath("blitz-rewards-s0", "legendary"),
};

// Map epoch to video collection
const videoCollections: Record<string, Record<string, string>> = {
  "eternum-rewards-s1": chestOpeningVideoEternumRewardsS1,
  "blitz-rewards-s0": chestOpeningVideoBlitzRewardsS0,
};

/**
 * Get the appropriate chest opening video based on rarity and epoch.
 * Exported for use by parent components.
 * @param rarity - The chest rarity (common, uncommon, rare, epic, legendary)
 * @param epoch - The chest epoch ("eternum-rewards-s1" | "blitz-rewards-s0")
 */
export function getChestOpeningVideo(rarity: string, epoch: string): string {
  const collection = videoCollections[epoch] || chestOpeningVideoEternumRewardsS1;
  // Fall back to closest available rarity if not found in collection
  return collection[rarity] || collection["rare"] || chestOpeningVideoEternumRewardsS1["common"];
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
        <video ref={videoRef} src={videoSrc} playsInline preload="auto" className="w-full h-full object-cover" />

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
