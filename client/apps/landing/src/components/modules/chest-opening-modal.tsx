import chestOpeningVideo from "@/assets/videos/chest-opening.mp4";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ChestOpeningModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  remainingChests: number;
  onChestOpened?: () => void;
}

export const ChestOpeningModal = ({ isOpen, onOpenChange, remainingChests, onChestOpened }: ChestOpeningModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoState, setVideoState] = useState<"loading" | "playing" | "ended">("loading");
  const [showWhiteScreen, setShowWhiteScreen] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  console.log("ChestOpeningModal - State:", {
    remainingChests,
    videoState,
    videoRef: videoRef.current,
    videoSrc: chestOpeningVideo,
    isOpen,
    isVideoReady,
    loadError,
    showWhiteScreen,
  });

  // Handle video loading and playing
  useEffect(() => {
    if (isOpen && isVideoReady && videoRef.current) {
      console.log("Video is ready, attempting to play...");

      const playVideo = async () => {
        try {
          videoRef.current!.currentTime = 0;
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

  const handleVideoEnd = () => {
    console.log("Video ended");

    // Hide video and show white screen
    setVideoState("ended");
    setShowWhiteScreen(true);

    // After 3 seconds, show text and trigger fade
    setTimeout(() => {
      setShowContent(true);
      onChestOpened?.();
    }, 3000);
  };

  const handleOpenNext = () => {
    if (remainingChests > 0 && videoRef.current) {
      setVideoState("playing");
      setShowContent(false);
      setShowWhiteScreen(false);
      videoRef.current.currentTime = 0;
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
            muted
            autoPlay={false}
            preload="auto"
            controls={false}
          >
            <source src={chestOpeningVideo} type="video/mp4" />
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
          {videoState === "ended" && (
            <div className="relative z-10 flex flex-col items-center justify-center gap-8">
              <h1
                style={{
                  fontSize: "2.25rem", // text-4xl
                  fontWeight: 700, // font-bold
                  color: "#FFD700", // text-gold
                  animation: "float 3s ease-in-out infinite", // animate-float
                  transition: "opacity 5000ms",
                  opacity: showContent ? 1 : 0,
                  // Responsive font size for md:text-6xl
                  // This is a simple example; you may want to use a CSS-in-JS solution for more complex breakpoints
                  ...(window.innerWidth >= 768 ? { fontSize: "3.75rem" } : {}),
                }}
              >
                You opened the chest!
              </h1>
            </div>
          )}

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
