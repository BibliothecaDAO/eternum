import chestOpeningCommon from "@/assets/videos/chest-opening/common.mp4";
import chestOpeningEpic from "@/assets/videos/chest-opening/epic.mp4";
import chestOpeningLegendary from "@/assets/videos/chest-opening/legendary.mp4";
import chestOpeningRare from "@/assets/videos/chest-opening/rare.mp4";
import chestOpeningUncommon from "@/assets/videos/chest-opening/uncommon.mp4";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChestAsset, ChestContent } from "./chest-content";

interface ChestOpeningModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  remainingChests: number;
  onChestOpened?: () => void;
  chestContent: ChestAsset[];
}

const chestOpeningVideo: Record<string, string> = {
  common: chestOpeningCommon,
  uncommon: chestOpeningUncommon,
  rare: chestOpeningRare,
  epic: chestOpeningEpic,
  legendary: chestOpeningLegendary,
};

export const ChestOpeningModal = ({
  isOpen,
  onOpenChange,
  remainingChests,
  onChestOpened,
  chestContent,
}: ChestOpeningModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoState, setVideoState] = useState<"loading" | "playing" | "ended">("loading");
  const [showWhiteScreen, setShowWhiteScreen] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [chestType, setChestType] = useState<string>("common");

  // Handle video loading and playing
  useEffect(() => {
    if (isOpen && isVideoReady && videoRef.current) {
      console.log("Video is ready, attempting to play...");

      const playVideo = async () => {
        try {
          videoRef.current!.currentTime = 0;
          videoRef.current!.volume = 1; // Reset volume to full
          await videoRef.current!.play();
          console.log("Video playing successfully");
          setVideoState("playing");
        } catch (error) {
          console.error("Error playing video:", error);
          // Try playing without sound if autoplay policy blocks it
          if (videoRef.current) {
            videoRef.current.muted = true;
            try {
              await videoRef.current.play();
              console.log("Video playing muted");
              setVideoState("playing");
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
  }, [isOpen, isVideoReady]);

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

    // After 3 seconds, show text and trigger fade
    setTimeout(() => {
      setShowContent(true);
      onChestOpened?.();
    }, 500);
  };

  const handleOpenNext = () => {
    if (remainingChests > 0 && videoRef.current) {
      setVideoState("playing");
      setShowContent(false);
      setShowWhiteScreen(false);
      videoRef.current.currentTime = 0;
      videoRef.current.volume = 1; // Reset volume to full
      videoRef.current.play();
    }
  };

  const handleSkip = () => {
    console.log("Skipping video");

    // Stop video and immediately show content
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setVideoState("ended");
    setShowWhiteScreen(false);
    setShowContent(true);
    onChestOpened?.();
  };

  const handleClose = () => {
    setShowWhiteScreen(false);
    setShowContent(false);
    setVideoState("loading");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full w-full h-full p-0 border-0 bg-black">
        <DialogTitle className="sr-only">Chest Opening</DialogTitle>
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Video */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover ${
              videoState === "ended" ? "hidden" : videoState === "loading" ? "opacity-0" : "opacity-100"
            }`}
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
            preload="auto"
            controls={false}
          >
            <source src={chestOpeningVideo[chestType]} type="video/mp4" />
          </video>

          {/* Loading state */}
          {videoState === "loading" && !loadError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-gold" />
              <div className="text-gold text-xl">Loading chest...</div>
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
          {videoState === "ended" && <ChestContent showContent={showContent} chestContent={chestContent} />}

          {/* Controls */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4 z-[60]">
            {/* Skip button during video */}
            {videoState === "playing" && (
              <Button variant="outline" size="lg" onClick={handleSkip} className="text-gold">
                Skip
              </Button>
            )}

            {/* Stop Opening button only when content is shown */}
            {videoState === "ended" && showContent && (
              <Button variant="outline" size="lg" onClick={handleClose} className="text-gold">
                Stop Opening
              </Button>
            )}

            {/* Open Next button */}
            {remainingChests > 0 && videoState === "ended" && showContent && (
              <Button variant="cta" size="lg" onClick={handleOpenNext} className="">
                Open Next Chest ({remainingChests} remaining)
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
