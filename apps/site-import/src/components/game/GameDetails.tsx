import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Game } from "@/data/games";
import { useNavigate } from "@tanstack/react-router";
import {
  Users,
  DollarSign,
  Globe,
  Github,
  MessageCircle,
  Twitter,
  FileText,
  Gamepad2,
  Building,
  ArrowLeft,
  ExternalLink,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

function LiveIndicator() {
  return (
    <motion.div
      className="inline-flex items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="w-2 h-2 rounded-full bg-positive mr-2 bg-green-500" />
      <span className="text-sm text-positive">Live</span>
    </motion.div>
  );
}

// Screenshot Modal Component
function ScreenshotModal({
  images,
  currentIndex,
  onClose,
  onNext,
  onPrevious,
}: {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrevious();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrevious]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="relative w-full h-full flex items-center justify-center p-4">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 bg-black/50 backdrop-blur-sm z-10"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </Button>

          {/* Previous button */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/30 bg-black/50 backdrop-blur-sm z-10"
              onClick={(e) => {
                e.stopPropagation();
                onPrevious();
              }}
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
          )}

          {/* Image */}
          <motion.img
            key={currentIndex}
            src={images[currentIndex]}
            alt={`Screenshot ${currentIndex + 1}`}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next button */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/30 bg-black/50 backdrop-blur-sm z-10"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          )}

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function GameDetails({ game }: { game: Game }) {
  const navigate = useNavigate();
  const [selectedScreenshot, setSelectedScreenshot] = useState<number | null>(
    null
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "mainnet":
        return "border-positive text-positive";
      case "testnet":
        return "border-warning text-warning";
      case "development":
        return "border-info text-info";
      default:
        return "";
    }
  };

  const handleNextScreenshot = () => {
    if (selectedScreenshot !== null && game.backgroundImages) {
      setSelectedScreenshot((prev) =>
        prev !== null ? (prev + 1) % game.backgroundImages!.length : 0
      );
    }
  };

  const handlePreviousScreenshot = () => {
    if (selectedScreenshot !== null && game.backgroundImages) {
      setSelectedScreenshot((prev) =>
        prev !== null
          ? prev === 0
            ? game.backgroundImages!.length - 1
            : prev - 1
          : 0
      );
    }
  };

  return (
    <>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl rounded-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/games" })}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Games
          </Button>

          {/* Hero Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Game Info */}
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <motion.h1
                      className="text-4xl md:text-5xl font-bold mb-2"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      {game.title}
                    </motion.h1>
                    <div className="flex items-center gap-3 mb-4">
                      {game.isLive && <LiveIndicator />}
                      <Badge
                        variant="outline"
                        className={getStatusColor(game.status)}
                      >
                        {game.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>

                <motion.p
                  className="text-lg text-muted-foreground leading-relaxed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {game.description}
                </motion.p>
              </div>

              {/* Action Buttons */}
              <motion.div
                className="flex flex-wrap gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {game.links?.homepage && (
                  <Button
                    size="lg"
                    onClick={() => window.open(game.links?.homepage, "_blank")}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Play Now
                  </Button>
                )}
                {game.whitepaper && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => window.open(game.whitepaper, "_blank")}
                    className="gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Whitepaper
                  </Button>
                )}
              </motion.div>

              {/* Genres */}
              {game.genre && game.genre.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    GENRES
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {game.genre.map((g) => (
                      <Badge key={g} variant="secondary">
                        {g}
                      </Badge>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right Column - Video/Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="relative aspect-video rounded-2xl border border-white/10 overflow-hidden bg-card"
            >
              {game.video ? (
                <iframe
                  src={game.video}
                  title={`${game.title} Trailer`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <img
                  src={game.image}
                  alt={game.title}
                  className="w-full h-full object-cover"
                />
              )}
            </motion.div>
          </div>

          {/* Info Grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {/* Studio Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Studio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{game.studio}</p>
              </CardContent>
            </Card>

            {/* Players Card */}
            {game.players && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Active Players
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {game.players.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* TVL Card */}
            {game.tvl && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Total Value Locked
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    ${game.tvl.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Status Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4" />
                  Game Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant="outline"
                  className={`${getStatusColor(game.status)} text-base`}
                >
                  {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                </Badge>
              </CardContent>
            </Card>
          </motion.div>

          {/* Screenshots Section */}
          {game.backgroundImages && game.backgroundImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <h2 className="text-2xl font-bold mb-4">Screenshots</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {game.backgroundImages.map((img, index) => (
                  <motion.div
                    key={index}
                    className="relative aspect-video rounded-lg overflow-hidden bg-card cursor-pointer group"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8 + index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedScreenshot(index)}
                  >
                    <img
                      src={img}
                      alt={`${game.title} Screenshot ${index + 1}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-6 h-6 text-white"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Links Section */}
          {game.links && Object.keys(game.links).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
            >
              <h2 className="text-2xl font-bold mb-4">Connect</h2>
              <div className="flex flex-wrap gap-3">
                {game.links.homepage && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => window.open(game.links?.homepage, "_blank")}
                    className="gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    Website
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
                {game.links.discord && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => window.open(game.links?.discord, "_blank")}
                    className="gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Discord
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
                {game.links.twitter && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => window.open(game.links?.twitter, "_blank")}
                    className="gap-2"
                  >
                    <Twitter className="w-4 h-4" />
                    Twitter
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
                {game.links.github && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => window.open(game.links?.github, "_blank")}
                    className="gap-2"
                  >
                    <Github className="w-4 h-4" />
                    GitHub
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Screenshot Modal */}
      {selectedScreenshot !== null && game.backgroundImages && (
        <ScreenshotModal
          images={game.backgroundImages}
          currentIndex={selectedScreenshot}
          onClose={() => setSelectedScreenshot(null)}
          onNext={handleNextScreenshot}
          onPrevious={handlePreviousScreenshot}
        />
      )}
    </>
  );
}
