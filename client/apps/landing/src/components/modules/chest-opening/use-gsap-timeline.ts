import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";

// Timeline phase labels
export type TimelinePhase = "intro" | "shake" | "burst" | "reveal" | "outro";

interface UseGsapTimelineOptions {
  onComplete?: () => void;
  onPhaseChange?: (phase: TimelinePhase) => void;
  autoPlay?: boolean;
}

interface UseGsapTimelineReturn {
  timelineRef: React.MutableRefObject<gsap.core.Timeline | null>;
  currentPhase: TimelinePhase | null;
  isPlaying: boolean;
  progress: number;
  play: () => void;
  pause: () => void;
  restart: () => void;
  kill: () => void;
  seekTo: (phase: TimelinePhase) => void;
  createTimeline: (config: TimelineConfig) => gsap.core.Timeline;
}

interface TimelineConfig {
  targets: {
    container?: HTMLElement | null;
    video?: HTMLVideoElement | null;
    overlay?: HTMLElement | null;
    cards?: HTMLElement[] | NodeListOf<HTMLElement> | null;
  };
  durations?: {
    intro?: number;
    shake?: number;
    burst?: number;
    reveal?: number;
    outro?: number;
  };
}

const DEFAULT_DURATIONS = {
  intro: 0.5,
  shake: 0.8,
  burst: 0.3,
  reveal: 0.6,
  outro: 0.4,
};

export function useGsapTimeline(options: UseGsapTimelineOptions = {}): UseGsapTimelineReturn {
  const { onComplete, onPhaseChange, autoPlay = false } = options;

  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const [currentPhase, setCurrentPhase] = useState<TimelinePhase | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Cleanup timeline on unmount
  useEffect(() => {
    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
    };
  }, []);

  // Update phase when it changes
  const handlePhaseChange = useCallback(
    (phase: TimelinePhase) => {
      setCurrentPhase(phase);
      onPhaseChange?.(phase);
    },
    [onPhaseChange],
  );

  // Create a new timeline with the given configuration
  const createTimeline = useCallback(
    (config: TimelineConfig): gsap.core.Timeline => {
      // Kill existing timeline
      if (timelineRef.current) {
        timelineRef.current.kill();
      }

      const durations = { ...DEFAULT_DURATIONS, ...config.durations };
      const { targets } = config;

      // Create new timeline
      const tl = gsap.timeline({
        paused: !autoPlay,
        onComplete: () => {
          setIsPlaying(false);
          onComplete?.();
        },
        onUpdate: function () {
          setProgress(this.progress());
        },
      });

      // Add intro phase
      tl.addLabel("intro");
      if (targets.container) {
        tl.fromTo(
          targets.container,
          { opacity: 0 },
          { opacity: 1, duration: durations.intro, ease: "power2.out" },
          "intro",
        );
      }
      tl.call(() => handlePhaseChange("intro"), [], "intro");

      // Add shake phase (anticipation)
      tl.addLabel("shake", `intro+=${durations.intro}`);
      if (targets.container) {
        tl.to(
          targets.container,
          {
            x: "random(-5, 5)",
            duration: 0.05,
            repeat: Math.floor(durations.shake / 0.05),
            yoyo: true,
            ease: "none",
          },
          "shake",
        );
      }
      tl.call(() => handlePhaseChange("shake"), [], "shake");

      // Add burst phase (flash effect)
      tl.addLabel("burst", `shake+=${durations.shake}`);
      if (targets.overlay) {
        tl.fromTo(
          targets.overlay,
          { opacity: 0, scale: 0.8 },
          {
            opacity: 1,
            scale: 1,
            duration: durations.burst * 0.5,
            ease: "power4.in",
          },
          "burst",
        );
        tl.to(
          targets.overlay,
          {
            opacity: 0,
            duration: durations.burst * 0.5,
            ease: "power2.out",
          },
          `burst+=${durations.burst * 0.5}`,
        );
      }
      tl.call(() => handlePhaseChange("burst"), [], "burst");

      // Add reveal phase (cards appear)
      tl.addLabel("reveal", `burst+=${durations.burst}`);
      if (targets.cards && targets.cards.length > 0) {
        tl.fromTo(
          targets.cards,
          {
            scale: 0,
            rotation: 15,
            opacity: 0,
            y: 50,
          },
          {
            scale: 1,
            rotation: 0,
            opacity: 1,
            y: 0,
            duration: durations.reveal,
            stagger: 0.15,
            ease: "back.out(1.7)",
          },
          "reveal",
        );
      }
      tl.call(() => handlePhaseChange("reveal"), [], "reveal");

      // Add outro phase
      tl.addLabel("outro", `reveal+=${durations.reveal + 0.3}`);
      tl.call(() => handlePhaseChange("outro"), [], "outro");

      timelineRef.current = tl;

      if (autoPlay) {
        setIsPlaying(true);
      }

      return tl;
    },
    [autoPlay, handlePhaseChange, onComplete],
  );

  // Control functions
  const play = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const pause = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const restart = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.restart();
      setIsPlaying(true);
    }
  }, []);

  const kill = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
      setIsPlaying(false);
      setCurrentPhase(null);
      setProgress(0);
    }
  }, []);

  const seekTo = useCallback((phase: TimelinePhase) => {
    if (timelineRef.current) {
      timelineRef.current.seek(phase);
    }
  }, []);

  return {
    timelineRef,
    currentPhase,
    isPlaying,
    progress,
    play,
    pause,
    restart,
    kill,
    seekTo,
    createTimeline,
  };
}

// Utility function to create a simple reveal animation for cards
export function createCardRevealAnimation(
  cards: HTMLElement[] | NodeListOf<HTMLElement>,
  options: {
    duration?: number;
    stagger?: number;
    ease?: string;
    onComplete?: () => void;
  } = {},
): gsap.core.Timeline {
  const { duration = 0.6, stagger = 0.15, ease = "back.out(1.7)", onComplete } = options;

  return gsap.timeline({ onComplete }).fromTo(
    cards,
    {
      scale: 0,
      rotation: 15,
      opacity: 0,
      y: 50,
    },
    {
      scale: 1,
      rotation: 0,
      opacity: 1,
      y: 0,
      duration,
      stagger,
      ease,
    },
  );
}
