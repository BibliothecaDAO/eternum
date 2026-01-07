import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAmbienceAudio } from "@/hooks/use-ambience-audio";
import { AssetRarity } from "@/utils/cosmetics";
import { Loader2, Package, Play } from "lucide-react";
import gsap from "gsap";
import { ChestStageContainer, ChestStageContent } from "./chest-stage-container";

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

// Helper function to get the appropriate video based on device type
const getChestOpeningVideo = (chestType: string, isMobile: boolean) => {
  return isMobile ? chestOpeningVideoLowRes[chestType] : chestOpeningVideoHighRes[chestType];
};

// Loading messages for pending state
const loadingMessages = [
  "Preparing ancient relics from the depths...",
  "Revealing the spirits of the First Legacy...",
  "Unlocking weapons forged in winter's flame...",
  "Unleashing the aura of distinguished Realms...",
  "Blessing shields with winter magic...",
  "Gathering the Hunter's arsenal...",
  "Revealing platforms carved from sacred wood...",
  "Summoning the guardians of old...",
  "Manifesting golden magnificence...",
  "Blessing armor with timeless power...",
  "Unlocking blades of frozen steel...",
  "Revealing arrows touched by frost...",
];

interface OpeningStageProps {
  chestRarity: AssetRarity;
  isPending: boolean;
  isOpening: boolean;
  onVideoEnd: () => void;
  onSkip: () => void;
}

export function OpeningStage({ chestRarity, isPending, isOpening, onVideoEnd, onSkip }: OpeningStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);

  const [videoState, setVideoState] = useState<"loading" | "ready" | "playing" | "ended">("loading");
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const isMobile = useIsMobile();

  // Ambience audio
  const ambienceAudio = useAmbienceAudio({
    src: "/sound/chest-opening/open_chest_ambient.wav",
    volume: 0.2,
    quietVolume: 0.02,
    loop: true,
  });

  // Start ambient music when opening stage begins
  useEffect(() => {
    if (isOpening && !isMobile) {
      ambienceAudio.play();
    }

    return () => {
      ambienceAudio.stop();
    };
  }, [isOpening, isMobile]);

  // Cycle loading messages
  useEffect(() => {
    if (!isPending) return;

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isPending]);

  // Handle video ready state
  useEffect(() => {
    if (videoState === "ready" && isOpening) {
      if (isMobile) {
        // On mobile, show play button
        setShowPlayButton(true);
      } else {
        // On desktop, try to auto-play
        playVideos();
      }
    }
  }, [videoState, isOpening, isMobile]);

  // Fallback timeout for mobile
  useEffect(() => {
    if (!isOpening || !isMobile) return;

    const fallbackTimeout = setTimeout(() => {
      if (videoState === "loading") {
        setShowPlayButton(true);
      }
    }, 3000);

    return () => clearTimeout(fallbackTimeout);
  }, [isOpening, isMobile, videoState]);

  // Video audio fade out near end
  useEffect(() => {
    if (!videoRef.current || videoState !== "playing") return;

    const fadeOutDuration = 1000;
    const checkInterval = 100;

    const interval = setInterval(() => {
      if (!videoRef.current) return;

      const timeUntilEnd = (videoRef.current.duration - videoRef.current.currentTime) * 1000;

      if (timeUntilEnd <= fadeOutDuration && timeUntilEnd > 0) {
        const newVolume = Math.max(0, timeUntilEnd / fadeOutDuration);
        videoRef.current.volume = newVolume;
      }
    }, checkInterval);

    return () => clearInterval(interval);
  }, [videoState]);

  const playVideos = useCallback(async () => {
    setShowPlayButton(false);

    try {
      // Sync background video
      if (backgroundVideoRef.current && videoRef.current) {
        backgroundVideoRef.current.currentTime = videoRef.current.currentTime;
      }

      // Play both videos
      const playPromises = [];
      if (videoRef.current) {
        videoRef.current.volume = 1;
        playPromises.push(videoRef.current.play());
      }
      if (backgroundVideoRef.current) {
        playPromises.push(backgroundVideoRef.current.play());
      }

      await Promise.all(playPromises);
      setVideoState("playing");

      // Start ambient music on mobile after user interaction
      if (isMobile) {
        ambienceAudio.play();
      }
    } catch (error) {
      console.error("Error playing video:", error);
      // Try muted playback
      if (videoRef.current) {
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
          if (backgroundVideoRef.current) {
            await backgroundVideoRef.current.play();
          }
          setVideoState("playing");
        } catch {
          // Show play button as fallback
          setShowPlayButton(true);
        }
      }
    }
  }, [isMobile, ambienceAudio]);

  const handleVideoEnd = useCallback(() => {
    setVideoState("ended");

    // Resume ambient audio on mobile
    if (isMobile) {
      ambienceAudio.fadeToNormal();
    }

    // Play burst animation
    if (burstRef.current) {
      gsap
        .timeline()
        .to(burstRef.current, {
          opacity: 1,
          scale: 1.5,
          duration: 0.3,
          ease: "power4.in",
        })
        .to(burstRef.current, {
          opacity: 0,
          duration: 0.5,
          ease: "power2.out",
          onComplete: onVideoEnd,
        });
    } else {
      onVideoEnd();
    }
  }, [isMobile, ambienceAudio, onVideoEnd]);

  const handleSkip = useCallback(() => {
    // Stop videos
    if (videoRef.current) videoRef.current.pause();
    if (backgroundVideoRef.current) backgroundVideoRef.current.pause();

    // Resume ambient on mobile
    if (isMobile) {
      ambienceAudio.fadeToNormal();
    }

    onSkip();
  }, [isMobile, ambienceAudio, onSkip]);

  const videoSrc = getChestOpeningVideo(chestRarity, isMobile);

  return (
    <ChestStageContainer>
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
      >
        {/* Pending state */}
        {isPending && (
          <ChestStageContent>
            <div className="flex flex-col items-center justify-center gap-6 text-center px-4">
              <div className="relative">
                <Package className="w-20 h-20 text-gold animate-pulse" />
                <Loader2 className="absolute -bottom-2 -right-2 w-8 h-8 text-gold animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gold">Opening Chest...</h2>
                <p className="text-gold/60 text-sm max-w-xs">{loadingMessages[currentMessageIndex]}</p>
              </div>
            </div>
          </ChestStageContent>
        )}

        {/* Video layers */}
        {isOpening && (
          <>
            {/* Background video (blurred) */}
            <video
              ref={backgroundVideoRef}
              className={`absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-50 rounded-2xl ${
                videoState === "ended" ? "hidden" : ""
              }`}
              src={videoSrc}
              playsInline
              muted
              preload={isMobile ? "metadata" : "auto"}
              style={{ filter: "blur(8px) brightness(0.7)" }}
            />

            {/* Main video */}
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-contain ${videoState === "ended" ? "hidden" : ""}`}
              onEnded={handleVideoEnd}
              onLoadedData={() => setVideoState("ready")}
              onCanPlayThrough={() => setVideoState("ready")}
              onError={() => {
                console.error("Video error");
                setShowPlayButton(true);
              }}
              playsInline
              preload={isMobile ? "metadata" : "auto"}
              crossOrigin="anonymous"
            >
              <source src={videoSrc} type="video/mp4" />
            </video>

            {/* Play button */}
            {showPlayButton && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/80 rounded-2xl">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-b from-gold/20 to-gold/5 flex items-center justify-center border-2 border-gold/50">
                    <Package size={48} className="text-gold" strokeWidth={1.5} />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-gold">Ready to Open</h3>
                  <p className="text-sm text-white/50">Tap below to reveal your loot</p>
                </div>
                <Button variant="cta" size="lg" onClick={playVideos} className="gap-2">
                  <Play className="w-5 h-5" />
                  Open Chest
                </Button>
              </div>
            )}

            {/* Burst effect overlay */}
            <div
              ref={burstRef}
              className="absolute inset-0 bg-white pointer-events-none opacity-0 scale-0 rounded-2xl"
            />

            {/* Skip button */}
            {videoState === "playing" && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleSkip}
                  className="text-gold border-gold/50 hover:bg-gold/10"
                >
                  Skip
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ChestStageContainer>
  );
}

// Pending overlay component (simpler version for use in orchestrator)
export function PendingOverlay() {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <ChestStageContainer>
      <ChestStageContent>
        <div className="flex flex-col items-center justify-center gap-6 text-center px-4">
          <div className="relative">
            <Package className="w-20 h-20 text-gold animate-pulse" />
            <Loader2 className="absolute -bottom-2 -right-2 w-8 h-8 text-gold animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gold">Opening Chest...</h2>
            <p className="text-gold/60 text-sm max-w-xs">{loadingMessages[currentMessageIndex]}</p>
          </div>
        </div>
      </ChestStageContent>
    </ChestStageContainer>
  );
}
