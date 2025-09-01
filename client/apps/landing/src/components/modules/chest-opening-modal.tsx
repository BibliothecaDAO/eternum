import chestOpeningCommon from "@videos/chest-opening/high-res/common.mp4";
import chestOpeningEpic from "@videos/chest-opening/high-res/epic.mp4";
import chestOpeningLegendary from "@videos/chest-opening/high-res/legendary.mp4";
import chestOpeningRare from "@videos/chest-opening/high-res/rare.mp4";
import chestOpeningUncommon from "@videos/chest-opening/high-res/uncommon.mp4";

import chestOpeningCommonLowRes from "@videos/chest-opening/low-res/common.mov";
import chestOpeningEpicLowRes from "@videos/chest-opening/low-res/epic.mov";
import chestOpeningLegendaryLowRes from "@videos/chest-opening/low-res/legendary.mov";
import chestOpeningRareLowRes from "@videos/chest-opening/low-res/rare.mov";
import chestOpeningUncommonLowRes from "@videos/chest-opening/low-res/uncommon.mov";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAmbienceAudio } from "@/hooks/use-ambience-audio";
import { useChestContent } from "@/hooks/use-chest-content";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOpenChest } from "@/hooks/use-open-chest";
import { useLootChestOpeningStore } from "@/stores/loot-chest-opening";
import { AssetRarity, ChestAsset } from "@/utils/cosmetics";
import { Loader2, Package } from "lucide-react";
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

// Helper function to get the appropriate video based on device type
const getChestOpeningVideo = (chestType: string, isMobile: boolean) => {
  return isMobile ? chestOpeningVideoLowRes[chestType] : chestOpeningVideoHighRes[chestType];
};

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
  const [showPlayButton, setShowPlayButton] = useState(false);
  const isMobile = useIsMobile();

  const { chestOpenTimestamp, setChestOpenTimestamp } = useLootChestOpeningStore();
  const { chestContent, resetChestContent } = useChestContent(env.VITE_PUBLIC_CHEST_DEBUG_MODE, chestOpenTimestamp);

  const ambienceAudio = useAmbienceAudio({
    src: "/sound/chest-opening/open_chest_ambient.wav",
    volume: 0.2,
    quietVolume: 0.2,
    loop: true,
    isMobile,
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
      setShowPlayButton(false);

      // On mobile, add a fallback timeout in case video events don't fire
      if (isMobile) {
        const fallbackTimeout = setTimeout(() => {
          console.log("Mobile fallback: showing play button after timeout");
          setIsVideoReady(true);
        }, 3000); // 3 seconds should be enough for metadata to load

        return () => clearTimeout(fallbackTimeout);
      }
    }
  }, [chestContent, isMobile]);

  const { clearLootChestOpening, setOpenedChestTokenId } = useLootChestOpeningStore();

  // Handle video loading and playing - only when chestContent is available and video is ready
  useEffect(() => {
    if (isVideoReady && videoRef.current && chestContent && chestContent.length > 0) {
      console.log("Video is ready, attempting to play...");

      // On mobile, show play button instead of auto-playing
      if (isMobile) {
        setShowPlayButton(true);
        return;
      }

      const playVideo = async () => {
        try {
          // Sync background video with main video
          if (backgroundVideoRef.current && videoRef.current) {
            backgroundVideoRef.current.currentTime = videoRef.current.currentTime;
          }

          // Play both videos simultaneously
          const playPromises = [];
          if (videoRef.current) {
            videoRef.current.volume = 1;
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
              setShowPlayButton(true);
            }
          }
        }
      };

      playVideo();
    }
  }, [isVideoReady, chestContent, chestType, isMobile]);

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

  const handleManualPlay = async () => {
    setShowPlayButton(false);

    try {
      if (videoRef.current) {
        videoRef.current.muted = false;
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
      console.log("Videos playing successfully via manual trigger with sound");
      setVideoState("playing");
      // Fade ambience audio to quiet when video starts
      ambienceAudio.fadeToQuiet(500);
    } catch (error) {
      console.error("Error playing video with sound:", error);
      // On mobile, if we can't play with sound, skip the video
      handleSkip();
    }
  };

  const { openChest } = useOpenChest();
  const [isChestOpeningLoading, setIsChestOpeningLoading] = useState(false);

  const handleOpenChest = () => {
    if (!nextToken) return;

    // Set timestamp for when chest is opened to listen for new events
    if (!env.VITE_PUBLIC_CHEST_DEBUG_MODE) {
      openChest({
        tokenId: BigInt(nextToken),
        onSuccess: () => {
          console.log("Chest opened successfully");
          setIsChestOpeningLoading(true);
          setOpenedChestTokenId(nextToken);
          // Reset chest content to empty array
          resetChestContent();
          // Immediately reset video state to loading when opening new chest
          setVideoState("loading");
          setShowWhiteScreen(false);
          setShowContent(false);
          setIsVideoReady(false);
          setLoadError(false);
          setShowPlayButton(false);
          setChestOpenTimestamp(Math.floor(Date.now() / 1000));
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

  // Check if we should show loading state - show until video is ready
  const shouldShowLoading =
    !chestContent ||
    chestContent.length === 0 ||
    (videoState === "loading" && !isVideoReady && !loadError && !showPlayButton);

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="max-w-full w-full h-full p-0 border-0 bg-black text-gold">
        <DialogTitle className="sr-only text-white">Chest Opening</DialogTitle>

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
                src={getChestOpeningVideo(chestType, isMobile)}
                playsInline
                muted={true}
                autoPlay={false}
                preload={isMobile ? "metadata" : "auto"}
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
                preload={isMobile ? "metadata" : "auto"}
                controls={false}
                crossOrigin="anonymous"
              >
                <source src={getChestOpeningVideo(chestType, isMobile)} type="video/mp4" />
              </video>
            </div>
          )}

          {/* Play button for mobile */}
          {showPlayButton && !shouldShowLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4 px-6">
                {/* Chest icon */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-b from-gold/20 to-gold/5 flex items-center justify-center border-2 border-gold/50">
                    <Package size={48} className="text-gold" strokeWidth={1.5} />
                  </div>
                  {/* Sparkle effects around the chest */}
                  <div className="absolute -top-1 -right-1">
                    <div className="w-3 h-3 bg-gold/40 rounded-full animate-pulse" />
                  </div>
                  <div className="absolute -bottom-1 -left-1">
                    <div className="w-2 h-2 bg-gold/30 rounded-full animate-pulse animation-delay-200" />
                  </div>
                  <div className="absolute top-4 -right-3">
                    <div className="w-2 h-2 bg-gold/50 rounded-full animate-pulse animation-delay-400" />
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-gold">Ready to Open</h3>
                  <p className="text-sm text-gray-400 max-w-xs">Tap below to reveal your loot chest</p>
                </div>

                <Button
                  variant="default"
                  size="lg"
                  onClick={handleManualPlay}
                  className="bg-gold hover:bg-gold/90 text-black font-bold px-8 py-3 text-lg min-h-[52px] shadow-lg"
                >
                  Open Chest
                </Button>
              </div>
            </div>
          )}

          {/* Loading state */}
          {shouldShowLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
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
