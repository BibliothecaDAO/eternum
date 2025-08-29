import chestOpeningCommon from "@videos/chest-opening/common.mp4";
import chestOpeningEpic from "@videos/chest-opening/epic.mp4";
import chestOpeningLegendary from "@videos/chest-opening/legendary.mp4";
import chestOpeningRare from "@videos/chest-opening/rare.mp4";
import chestOpeningUncommon from "@videos/chest-opening/uncommon.mp4";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAmbienceAudio } from "@/hooks/use-ambience-audio";
import { useChestContent } from "@/hooks/use-chest-content";
import { useOpenChest } from "@/hooks/use-open-chest";
import { useVideoPreloader } from "@/hooks/use-video-preloader";
import { useLootChestOpeningStore } from "@/stores/loot-chest-opening";
import { AssetRarity, ChestAsset } from "@/utils/cosmetics";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { env } from "../../../env";
import { ChestContent } from "./chest-content";

const LoadingAnimation = () => {
  return (
    <div className="p-6 sm:p-10 w-1/3 sm:w-1/6 flex justify-center">
      <img src="/images/logos/eternum-loader.png" className="scale-75 sm:scale-50 self-center" />
    </div>
  );
};

interface ChestOpeningModalProps {
  remainingChests: number;
  nextToken: string | null;
}

const chestOpeningVideo: Record<string, string> = {
  common: chestOpeningCommon,
  uncommon: chestOpeningUncommon,
  rare: chestOpeningRare,
  epic: chestOpeningEpic,
  legendary: chestOpeningLegendary,
};

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

export const ChestOpeningModal = ({ remainingChests, nextToken }: ChestOpeningModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const [videoState, setVideoState] = useState<"loading" | "playing" | "ended">("loading");
  const [showWhiteScreen, setShowWhiteScreen] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [chestType, setChestType] = useState<ChestAsset["rarity"]>(AssetRarity.Common);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const { chestOpenTimestamp, setChestOpenTimestamp } = useLootChestOpeningStore();
  const { chestContent, resetChestContent } = useChestContent(env.VITE_PUBLIC_CHEST_DEBUG_MODE, chestOpenTimestamp);

  // Preload all chest videos when modal mounts
  const { allVideosLoaded } = useVideoPreloader(chestOpeningVideo);

  const ambienceAudio = useAmbienceAudio({
    src: "/sound/music/ShadowSong.mp3",
    volume: 0.4,
    quietVolume: 0.1,
    loop: true,
  });

  // Start ambient music when modal opens
  useEffect(() => {
    ambienceAudio.play();

    // Cleanup: stop audio when component unmounts
    return () => {
      ambienceAudio.stop();
    };
  }, []);

  // Cycle through loading messages every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (chestContent && chestContent.length > 0) {
      // Find the rarest item from all chest content
      const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary"];
      const rarestItem = chestContent.reduce((rarest, current) => {
        const rarestIndex = rarityOrder.indexOf(rarest.rarity);
        const currentIndex = rarityOrder.indexOf(current.rarity);
        return currentIndex > rarestIndex ? current : rarest;
      });
      setChestType(rarestItem.rarity);
      setIsChestOpeningLoading(false);

      // Reset all modal states when new chest content is detected
      setVideoState("loading");
      setShowWhiteScreen(false);
      setShowContent(false);
      setIsVideoReady(false);
      setLoadError(false);
    }
  }, [chestContent]);

  const { clearLootChestOpening, setOpenedChestTokenId } = useLootChestOpeningStore();

  // Handle video loading and playing - only when chestContent is available and videos are preloaded
  useEffect(() => {
    if (isVideoReady && videoRef.current && chestContent && chestContent.length > 0 && allVideosLoaded) {
      console.log("Video is ready and preloaded, attempting to play...");

      const playVideo = async () => {
        try {
          // Use cached video if available
          const cachedVideo = (window as any).__videoCache?.[chestOpeningVideo[chestType]];
          if (cachedVideo && videoRef.current) {
            // Copy preloaded video properties to our video element
            videoRef.current.currentTime = 0;
            videoRef.current.volume = 1;
          }

          // Sync background video with main video
          if (backgroundVideoRef.current && videoRef.current) {
            backgroundVideoRef.current.currentTime = videoRef.current.currentTime;
          }

          // Play both videos simultaneously
          const playPromises = [];
          if (videoRef.current) {
            playPromises.push(videoRef.current.play());
          }
          if (backgroundVideoRef.current) {
            playPromises.push(backgroundVideoRef.current.play());
          }

          await Promise.all(playPromises);
          console.log("Videos playing successfully");
          setVideoState("playing");
          // Fade ambience audio to quiet when video starts
          ambienceAudio.fadeToQuiet(500);
        } catch (error) {
          console.error("Error playing video:", error);
          // Try playing without sound if autoplay policy blocks it
          if (videoRef.current) {
            videoRef.current.muted = true;
            try {
              const playPromises = [];
              playPromises.push(videoRef.current.play());
              if (backgroundVideoRef.current) {
                playPromises.push(backgroundVideoRef.current.play());
              }
              await Promise.all(playPromises);
              console.log("Videos playing muted");
              setVideoState("playing");
              // Fade ambience audio to quiet when video starts
              ambienceAudio.fadeToQuiet(500);
            } catch (e) {
              console.error("Failed to play even when muted:", e);
              // Show manual play button as fallback
              setVideoState("playing");
            }
          }
        }
      };

      playVideo();
    }
  }, [isVideoReady, chestContent, allVideosLoaded, chestType]);

  // Fade out audio before video ends
  useEffect(() => {
    if (!videoRef.current || videoState !== "playing") return;

    const fadeOutDuration = 1000; // 1 second fade out
    const checkInterval = 100; // Check every 100ms

    const interval = setInterval(() => {
      if (!videoRef.current) return;

      const timeUntilEnd = (videoRef.current.duration - videoRef.current.currentTime) * 1000;

      if (timeUntilEnd <= fadeOutDuration && timeUntilEnd > 0) {
        // Calculate volume based on time remaining
        const newVolume = Math.max(0, timeUntilEnd / fadeOutDuration);
        videoRef.current.volume = newVolume;
      }
    }, checkInterval);

    return () => clearInterval(interval);
  }, [videoState]);

  const handleVideoEnd = () => {
    console.log("Video ended");

    // Hide video and show white screen
    setVideoState("ended");
    setShowWhiteScreen(true);

    // Restore ambience audio to normal volume when video ends
    ambienceAudio.fadeToNormal(500);

    // After 3 seconds, show text and trigger fade
    setTimeout(() => {
      setShowContent(true);
    }, 500);
  };

  const { openChest } = useOpenChest();
  const [isChestOpeningLoading, setIsChestOpeningLoading] = useState(false);

  const handleOpenChest = () => {
    if (!nextToken) return;
    setIsChestOpeningLoading(true);

    // Set timestamp for when chest is opened to listen for new events
    setChestOpenTimestamp(Math.floor(Date.now() / 1000));

    // Immediately reset video state to loading when opening new chest
    setVideoState("loading");
    setShowWhiteScreen(false);
    setShowContent(false);
    setIsVideoReady(false);
    setLoadError(false);

    // Reset chest content to empty array
    resetChestContent();

    if (!env.VITE_PUBLIC_CHEST_DEBUG_MODE) {
      openChest({
        tokenId: BigInt(nextToken),
        onSuccess: () => {
          console.log("Chest opened successfully");
          setOpenedChestTokenId(nextToken);
        },
        onError: (error) => {
          console.error("Failed to open chest:", error);
        },
      });
    }
  };
  const handleSkip = () => {
    console.log("Skipping video");

    // Stop both videos and immediately show content
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (backgroundVideoRef.current) {
      backgroundVideoRef.current.pause();
    }
    setVideoState("ended");
    setShowWhiteScreen(false);
    setShowContent(true);

    // Restore ambience audio to normal volume when skipping
    ambienceAudio.fadeToNormal(200);
  };

  const handleClose = () => {
    setShowWhiteScreen(false);
    setShowContent(false);
    setVideoState("loading");

    // Stop ambience audio when closing modal
    ambienceAudio.stop();

    clearLootChestOpening();
  };

  // Check if we should show loading state - show until both videos and chest content are loaded
  const shouldShowLoading =
    !chestContent || chestContent.length === 0 || (videoState === "loading" && !loadError) || !allVideosLoaded;

  return (
    <Dialog open={true} onOpenChange={clearLootChestOpening}>
      <DialogContent className="max-w-full w-full h-full p-0 border-0 bg-black">
        <DialogTitle className="sr-only">Chest Opening</DialogTitle>
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Video layers - only show when chestContent is available */}
          {chestContent && chestContent.length > 0 && (
            <div
              className={`absolute inset-0 ${
                videoState === "ended" ? "hidden" : videoState === "loading" ? "opacity-0" : "opacity-100"
              }`}
            >
              {/* Background layer: Blurred video fill */}
              <video
                ref={backgroundVideoRef}
                className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-50"
                src={chestOpeningVideo[chestType]}
                playsInline
                muted={true}
                autoPlay={false}
                preload={window.innerWidth < 768 ? "metadata" : "auto"}
                controls={false}
                style={{ filter: "blur(8px) brightness(0.7)" }}
              />

              {/* Foreground layer: Main video with proper aspect ratio */}
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain scale-150"
                onEnded={handleVideoEnd}
                onError={(e) => {
                  console.error("Video error:", e);
                  setLoadError(true);
                  setVideoState("playing");
                }}
                onLoadedData={() => {
                  console.log("Video data loaded");
                  setIsVideoReady(true);
                }}
                onLoadedMetadata={() => console.log("Video metadata loaded")}
                onCanPlay={() => console.log("Video can play")}
                onCanPlayThrough={() => {
                  console.log("Video can play through without buffering");
                  setIsVideoReady(true);
                }}
                onPlay={() => console.log("Video started playing")}
                onPause={() => console.log("Video paused")}
                onTimeUpdate={(e) => {
                  const video = e.currentTarget;
                  if (video.currentTime > 0 && video.currentTime < 1) {
                    console.log("Video is playing, current time:", video.currentTime);
                  }
                }}
                playsInline
                muted={false}
                autoPlay={false}
                preload={window.innerWidth < 768 ? "metadata" : "auto"}
                controls={false}
                crossOrigin="anonymous"
              >
                <source src={chestOpeningVideo[chestType]} type="video/mp4" />
              </video>
            </div>
          )}

          {/* Loading state */}
          {shouldShowLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
              <LoadingAnimation />
              <div className="text-gold text-base sm:text-xl px-4 text-center">
                {loadingMessages[currentMessageIndex]}
              </div>
            </div>
          )}

          {/* White screen overlay */}
          {showWhiteScreen && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "white",
                transition: "opacity 3000ms ease-out",
                opacity: showContent ? 0 : 1,
              }}
            ></div>
          )}

          {/* Complete state content */}
          {videoState === "ended" && (
            <ChestContent chestType={chestType} showContent={showContent} chestContent={chestContent} />
          )}

          {/* Controls */}
          <div
            className="absolute bottom-8 sm:bottom-12 left-1/2 transform -translate-x-1/2 flex gap-2 sm:gap-4 z-[60] px-4 max-w-full"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {/* Skip button during video */}
            {videoState === "playing" && (
              <Button variant="outline" size="lg" onClick={handleSkip} className="text-gold min-h-[44px] px-6">
                Skip
              </Button>
            )}

            {/* Stop Opening button only when content is shown */}
            {videoState === "ended" && showContent && (
              <Button variant="outline" size="lg" onClick={handleClose} className="text-gold min-h-[44px] px-4 sm:px-6">
                <span className="hidden sm:inline">Stop Opening</span>
                <span className="sm:hidden">Stop</span>
              </Button>
            )}

            {/* Open Next button */}
            {remainingChests > 0 && nextToken && videoState === "ended" && showContent && (
              <Button
                variant="cta"
                size="lg"
                onClick={handleOpenChest}
                className="min-h-[44px] px-4 sm:px-6"
                disabled={isChestOpeningLoading}
              >
                {isChestOpeningLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Opening...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">{`Open Next Chest (${remainingChests} remaining)`}</span>
                    <span className="sm:hidden">{`Open Next (${remainingChests})`}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
