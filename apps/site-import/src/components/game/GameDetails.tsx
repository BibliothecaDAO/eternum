import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
      className="inline-flex items-center rounded-full border border-emerald-400/35 bg-black/35 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-emerald-300"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.55, 1, 0.55] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-300" />
      Live
    </motion.div>
  );
}

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
        <div className="relative flex h-full w-full items-center justify-center p-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 bg-black/50 backdrop-blur-sm z-10"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </Button>

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

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function statusChipClasses(status: Game["status"]) {
  if (status === "mainnet") {
    return "border-emerald-400/40 text-emerald-300 bg-emerald-400/10";
  }
  if (status === "testnet") {
    return "border-amber-300/40 text-amber-200 bg-amber-300/10";
  }

  return "border-sky-300/35 text-sky-200 bg-sky-300/10";
}

function openExternal(url?: string) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function GameDetails({ game }: { game: Game }) {
  const navigate = useNavigate();
  const [selectedScreenshot, setSelectedScreenshot] = useState<number | null>(
    null
  );

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

  const statusLabel =
    game.status.charAt(0).toUpperCase() + game.status.slice(1);

  return (
    <>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl rounded-2xl realm-games-detail-shell">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="space-y-6 sm:space-y-8"
        >
          <Button
            variant="rune"
            size="sm"
            onClick={() => navigate({ to: "/games" })}
            className="mb-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Games
          </Button>

          <section className="realm-panel realm-grid-scan realm-games-detail-hero rounded-2xl p-5 sm:p-6 lg:p-7">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
              <div className="space-y-5">
                <div>
                  <p className="realm-banner">Campaign Brief</p>
                  <motion.h1
                    className="realm-title mt-3 text-3xl sm:text-4xl lg:text-5xl"
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    {game.title}
                  </motion.h1>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {game.isLive ? <LiveIndicator /> : null}
                    <Badge
                      variant="outline"
                      className={`uppercase tracking-[0.12em] ${statusChipClasses(
                        game.status
                      )}`}
                    >
                      {game.status}
                    </Badge>
                  </div>
                </div>

                <p className="text-base sm:text-lg leading-relaxed text-foreground/82">
                  {game.description}
                </p>

                <div className="flex flex-wrap gap-3">
                  {game.links?.homepage ? (
                    <Button
                      size="lg"
                      variant="rune"
                      onClick={() => openExternal(game.links?.homepage)}
                      className="gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Play Now
                    </Button>
                  ) : null}
                  {game.whitepaper ? (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => openExternal(game.whitepaper)}
                      className="gap-2 border-primary/35 bg-black/30 hover:bg-black/45"
                    >
                      <FileText className="h-4 w-4" />
                      Whitepaper
                    </Button>
                  ) : null}
                </div>

                {game.genre && game.genre.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground/65 uppercase tracking-[0.12em] mb-2">
                      Genres
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {game.genre.map((genre) => (
                        <span
                          key={genre}
                          className="rounded-md border border-primary/25 bg-black/35 px-2 py-1 text-xs text-foreground/80"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                className="realm-games-detail-media relative aspect-video overflow-hidden rounded-xl border border-primary/25"
              >
                {game.video ? (
                  <iframe
                    src={game.video}
                    title={`${game.title} Trailer`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <img
                    src={game.image}
                    alt={game.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </motion.div>
            </div>
          </section>

          <motion.section
            className="realm-games-detail-stats grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <article className="realm-panel realm-games-detail-stat rounded-xl p-4">
              <p className="inline-flex items-center gap-2 text-sm text-foreground/60">
                <Building className="h-4 w-4" />
                Studio
              </p>
              <p className="mt-3 text-lg font-semibold text-foreground">{game.studio}</p>
            </article>

            {game.players ? (
              <article className="realm-panel realm-games-detail-stat rounded-xl p-4">
                <p className="inline-flex items-center gap-2 text-sm text-foreground/60">
                  <Users className="h-4 w-4" />
                  Active Players
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground tabular-nums">
                  {game.players.toLocaleString()}
                </p>
              </article>
            ) : null}

            {game.tvl ? (
              <article className="realm-panel realm-games-detail-stat rounded-xl p-4">
                <p className="inline-flex items-center gap-2 text-sm text-foreground/60">
                  <DollarSign className="h-4 w-4" />
                  Total Value Locked
                </p>
                <p className="mt-3 text-lg font-semibold text-foreground tabular-nums">
                  ${game.tvl.toLocaleString()}
                </p>
              </article>
            ) : null}

            <article className="realm-panel realm-games-detail-stat rounded-xl p-4">
              <p className="inline-flex items-center gap-2 text-sm text-foreground/60">
                <Gamepad2 className="h-4 w-4" />
                Game Status
              </p>
              <div className="mt-3">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-sm uppercase tracking-[0.12em] ${statusChipClasses(
                    game.status
                  )}`}
                >
                  {statusLabel}
                </span>
              </div>
            </article>
          </motion.section>

          {game.backgroundImages && game.backgroundImages.length > 0 ? (
            <motion.section
              className="realm-panel realm-games-detail-gallery rounded-2xl p-5 sm:p-6"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <header className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="realm-banner">Recon Archive</p>
                  <h2 className="realm-title mt-3 text-2xl sm:text-3xl">Screenshots</h2>
                </div>
                <span className="realm-sigil">
                  {game.backgroundImages.length} captures
                </span>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {game.backgroundImages.map((img, index) => (
                  <motion.button
                    key={img}
                    type="button"
                    className="realm-games-detail-shot group relative aspect-video cursor-pointer overflow-hidden rounded-lg border border-primary/25 bg-black/35 text-left"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.04 }}
                    whileHover={{ y: -2 }}
                    onClick={() => setSelectedScreenshot(index)}
                  >
                    <img
                      src={img}
                      alt={`${game.title} Screenshot ${index + 1}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
                  </motion.button>
                ))}
              </div>
            </motion.section>
          ) : null}

          {game.links && Object.keys(game.links).length > 0 ? (
            <motion.section
              className="realm-panel realm-games-detail-links rounded-2xl p-5 sm:p-6"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <header className="mb-4">
                <p className="realm-banner">Deploy Channels</p>
                <h2 className="realm-title mt-3 text-2xl sm:text-3xl">Connect</h2>
              </header>

              <div className="flex flex-wrap gap-3">
                {game.links.homepage ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => openExternal(game.links?.homepage)}
                    className="gap-2 border-primary/35 bg-black/30 hover:bg-black/45"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ) : null}
                {game.links.discord ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => openExternal(game.links?.discord)}
                    className="gap-2 border-primary/35 bg-black/30 hover:bg-black/45"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Discord
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ) : null}
                {game.links.twitter ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => openExternal(game.links?.twitter)}
                    className="gap-2 border-primary/35 bg-black/30 hover:bg-black/45"
                  >
                    <Twitter className="h-4 w-4" />
                    Twitter
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ) : null}
                {game.links.github ? (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => openExternal(game.links?.github)}
                    className="gap-2 border-primary/35 bg-black/30 hover:bg-black/45"
                  >
                    <Github className="h-4 w-4" />
                    GitHub
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ) : null}
              </div>
            </motion.section>
          ) : null}
        </motion.div>
      </div>

      {selectedScreenshot !== null && game.backgroundImages ? (
        <ScreenshotModal
          images={game.backgroundImages}
          currentIndex={selectedScreenshot}
          onClose={() => setSelectedScreenshot(null)}
          onNext={handleNextScreenshot}
          onPrevious={handlePreviousScreenshot}
        />
      ) : null}
    </>
  );
}
