import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCartridgeUsername } from "@/hooks/use-cartridge-username";
import { useAccountStore } from "@/hooks/store/use-account-store";
import {
  getAvatarUrl,
  useAvatarGallery,
  useAvatarHistory,
  useDeleteAvatar,
  useGenerateAvatar,
  useMyAvatar,
  useSelectAvatar,
} from "@/hooks/use-player-avatar";
import TextInput from "@/ui/design-system/atoms/text-input";

import { Button } from "@/ui/design-system/atoms";
import { RefreshButton } from "@/ui/design-system/atoms/refresh-button";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { AvatarImageGrid } from "@/ui/features/avatars/avatar-image-grid";
import { BlitzHighlightCardWithSelector } from "@/ui/shared/components/blitz-highlight-card";
import {
  BLITZ_CARD_DIMENSIONS,
  BLITZ_DEFAULT_SHARE_ORIGIN,
  BlitzHighlightPlayer,
  buildBlitzShareMessage,
} from "@/ui/shared/lib/blitz-highlight";
import { displayAddress } from "@/ui/utils/utils";
import { toPng } from "html-to-image";
import { Copy, Loader2, Share2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { type LandingLeaderboardEntry } from "../lib/landing-leaderboard-service";
import { MIN_REFRESH_INTERVAL_MS, useLandingLeaderboardStore } from "../lib/use-landing-leaderboard-store";

const getDisplayName = (entry: LandingLeaderboardEntry): string => {
  const candidate = entry.displayName?.trim();
  if (candidate) {
    return candidate;
  }

  return displayAddress(entry.address);
};

const toHighlightPlayer = (entry: LandingLeaderboardEntry): BlitzHighlightPlayer => ({
  rank: entry.rank,
  name: getDisplayName(entry),
  points: entry.points,
  address: entry.address,
  exploredTiles: entry.exploredTiles ?? null,
  exploredTilePoints: entry.exploredTilePoints ?? null,
  riftsTaken: entry.riftsTaken ?? null,
  riftPoints: entry.riftPoints ?? null,
  hyperstructuresConquered: entry.hyperstructuresConquered ?? null,
  hyperstructurePoints: entry.hyperstructurePoints ?? null,
  relicCratesOpened: entry.relicCratesOpened ?? null,
  relicCratePoints: entry.relicCratePoints ?? null,
  campsTaken: entry.campsTaken ?? null,
  campPoints: entry.campPoints ?? null,
  hyperstructuresHeld: entry.hyperstructuresHeld ?? null,
  hyperstructuresHeldPoints: entry.hyperstructuresHeldPoints ?? null,
});

export const LandingPlayer = () => {
  const account = useAccountStore((state) => state.account);
  const accountName = useAccountStore((state) => state.accountName);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;

  const normalizedPlayerAddress = playerAddress?.toLowerCase() ?? null;

  const { username: cartridgeUsername, isLoading: isCartridgeUsernameLoading } = useCartridgeUsername();
  const displayName = accountName || cartridgeUsername || "";
  const hasDisplayName = Boolean(displayName);
  const playerId = playerAddress ?? "";

  // Avatar management
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [showAvatarSection, setShowAvatarSection] = useState(true);
  const [avatarTabIndex, setAvatarTabIndex] = useState(0);
  const [lastGeneratedImages, setLastGeneratedImages] = useState<string[]>([]);
  const { data: myAvatar, isLoading: isLoadingAvatar } = useMyAvatar(playerId, playerId, displayName);
  const { data: avatarHistory } = useAvatarHistory(playerId, playerId, displayName, 1);
  const { data: galleryItems, isLoading: isGalleryLoading } = useAvatarGallery(40);

  const generateAvatar = useGenerateAvatar(playerId, playerId, displayName);
  const deleteAvatar = useDeleteAvatar(playerId, playerId, displayName);
  const selectAvatar = useSelectAvatar(playerId, playerId, displayName);

  const fetchLeaderboard = useLandingLeaderboardStore((state) => state.fetchLeaderboard);
  const championEntry = useLandingLeaderboardStore((state) => state.championEntry);
  const isLeaderboardFetching = useLandingLeaderboardStore((state) => state.isFetching);
  const fetchPlayerEntry = useLandingLeaderboardStore((state) => state.fetchPlayerEntry);
  const playerEntryState = useLandingLeaderboardStore((state) =>
    normalizedPlayerAddress ? state.playerEntries[normalizedPlayerAddress] : undefined,
  );
  const lastLeaderboardFetchAt = useLandingLeaderboardStore((state) => state.lastFetchAt);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [refreshCooldownMs, setRefreshCooldownMs] = useState(0);

  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!playerAddress) {
      return;
    }

    void fetchPlayerEntry(playerAddress);
  }, [playerAddress, fetchPlayerEntry]);

  const playerEntry = playerEntryState?.data ?? null;
  const isPlayerLoading = Boolean(playerAddress) && (!playerEntryState || playerEntryState.isFetching);
  const playerError = playerEntryState?.error ?? null;
  const playerLastFetchAt = playerEntryState?.lastFetchedAt ?? null;

  useEffect(() => {
    const updateCooldown = () => {
      const timestamps = [lastLeaderboardFetchAt, playerLastFetchAt].filter((value): value is number => Boolean(value));
      if (timestamps.length === 0) {
        setRefreshCooldownMs(0);
        return;
      }

      const last = Math.max(...timestamps);
      const elapsed = Date.now() - last;
      const remaining = Math.max(0, MIN_REFRESH_INTERVAL_MS - elapsed);
      setRefreshCooldownMs(remaining);
    };

    updateCooldown();
    const interval = window.setInterval(updateCooldown, 250);

    return () => window.clearInterval(interval);
  }, [lastLeaderboardFetchAt, playerLastFetchAt]);

  const statusMessage = useMemo(() => {
    if (!playerAddress) {
      return "Connect a wallet to view your Blitz standing.";
    }

    if (!isPlayerLoading && !playerError && !playerEntry) {
      return "You haven't earned Blitz points yet. Play a round to climb the leaderboard.";
    }

    return null;
  }, [playerAddress, isPlayerLoading, playerError, playerEntry]);

  const highlightPlayer = useMemo<BlitzHighlightPlayer | null>(
    () => (playerEntry ? toHighlightPlayer(playerEntry) : null),
    [playerEntry],
  );

  const championLabel = useMemo(() => {
    if (!championEntry) {
      return null;
    }

    const name = championEntry.displayName?.trim();
    return name && name.length > 0 ? name : "Unknown champion";
  }, [championEntry]);

  const highlightRank = highlightPlayer?.rank ?? null;
  const highlightPoints = highlightPlayer?.points ?? null;

  const shareMessage = useMemo(
    () =>
      buildBlitzShareMessage({
        rank: highlightRank,
        points: highlightPoints,
        origin: typeof window !== "undefined" ? window.location.origin : BLITZ_DEFAULT_SHARE_ORIGIN,
      }),
    [highlightPoints, highlightRank],
  );

  const isRefreshing = isLeaderboardFetching || isPlayerLoading;
  const isCooldownActive = refreshCooldownMs > 0;
  const refreshSecondsLeft = Math.ceil(refreshCooldownMs / 1000);

  const handleRefresh = useCallback(() => {
    if (isRefreshing || isCooldownActive) {
      return;
    }

    void fetchLeaderboard();
    if (playerAddress) {
      void fetchPlayerEntry(playerAddress);
    }
  }, [fetchLeaderboard, fetchPlayerEntry, playerAddress, isRefreshing, isCooldownActive]);

  const handleShareOnX = useCallback(() => {
    if (!highlightPlayer) {
      toast.error("Final standings are still loading.");
      return;
    }

    const shareIntent = new URL("https://twitter.com/intent/tweet");
    shareIntent.searchParams.set("text", shareMessage);

    if (typeof window === "undefined") {
      toast.error("Sharing is not supported in this environment.");
      return;
    }

    window.open(shareIntent.toString(), "_blank", "noopener,noreferrer");
  }, [highlightPlayer, shareMessage]);

  const handleCopyImage = useCallback(async () => {
    if (typeof window === "undefined") {
      toast.error("Copying the image is not supported in this environment.");
      return;
    }

    if (!highlightPlayer || !cardRef.current) {
      toast.error("Your highlight card is still loading.");
      return;
    }

    if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
      toast.error("Copying images is not supported in this browser.");
      return;
    }

    setIsCopyingImage(true);

    try {
      const cardNode = cardRef.current.querySelector(".blitz-card-root") as HTMLElement | null;

      if (!cardNode) {
        throw new Error("Unable to find the highlight card markup.");
      }

      const { width, height } = BLITZ_CARD_DIMENSIONS;
      const fontReady =
        typeof document !== "undefined" && "fonts" in document ? document.fonts.ready.catch(() => undefined) : null;
      const waiters = fontReady ? [fontReady] : [];
      await Promise.all(waiters);

      const dataUrl = await toPng(cardNode, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#030d14",
        canvasWidth: width,
        canvasHeight: height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
        },
      });

      const blob = await fetch(dataUrl).then((response) => response.blob());
      const clipboardItem = new ClipboardItem({ "image/png": blob });

      try {
        await navigator.clipboard.write([clipboardItem]);
        toast.success("Copied highlight image to clipboard!");
      } catch (clipboardError) {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `realms-highlight-${Date.now()}.png`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.info("Clipboard not available; downloaded image instead.");
      }
    } catch (caughtError) {
      console.error("Failed to copy highlight image", caughtError);
      toast.error("Copy failed. Please try again.");
    } finally {
      setIsCopyingImage(false);
    }
  }, [highlightPlayer]);

  const handleCopyMessage = useCallback(async () => {
    if (!shareMessage.trim()) {
      toast.error("Nothing to copy yet.");
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      toast.error("Clipboard access is not available in this environment.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareMessage);
      toast.success("Winner message copied to clipboard.");
    } catch (caughtError) {
      console.error("Failed to copy winner message", caughtError);
      toast.error("Unable to copy the winner message.");
    }
  }, [shareMessage]);

  const handleGenerateAvatar = useCallback(async () => {
    if (!avatarPrompt.trim()) {
      toast.error("Please enter a description for your avatar.");
      return;
    }

    try {
      const result = await generateAvatar.mutateAsync({ prompt: avatarPrompt.trim() });
      toast.success("Avatar generated successfully!");
      setLastGeneratedImages(result.imageUrls ?? []);
      setAvatarPrompt("");
    } catch (error: any) {
      console.error("Failed to generate avatar:", error);
      toast.error(error?.message || "Failed to generate avatar. Please try again.");
    }
  }, [avatarPrompt, generateAvatar]);

  const handleDeleteAvatar = useCallback(async () => {
    try {
      await deleteAvatar.mutateAsync();
      toast.success("Avatar deleted. Using default avatar now.");
    } catch (error) {
      console.error("Failed to delete avatar:", error);
      toast.error("Failed to delete avatar. Please try again.");
    }
  }, [deleteAvatar]);

  const handleSelectAvatar = useCallback(
    async (imageUrl: string) => {
      if (!imageUrl || imageUrl === myAvatar?.avatarUrl) {
        return;
      }

      if (!playerAddress || !hasDisplayName) {
        toast.error("Connect with Cartridge to select an avatar.");
        return;
      }

      try {
        await selectAvatar.mutateAsync(imageUrl);
        toast.success("Avatar updated.");
      } catch (error: any) {
        console.error("Failed to set avatar:", error);
        toast.error(error?.message || "Failed to set avatar. Please try again.");
      }
    },
    [hasDisplayName, myAvatar?.avatarUrl, playerAddress, selectAvatar],
  );

  // Check if we're waiting for account name to load or avatar query to complete
  const isLoadingAvatarOrAccount =
    isLoadingAvatar || (Boolean(playerAddress) && !hasDisplayName && isCartridgeUsernameLoading);

  const currentAvatarUrl = useMemo(
    () => getAvatarUrl(playerAddress || "", myAvatar?.avatarUrl),
    [playerAddress, myAvatar?.avatarUrl],
  );
  const hasCustomAvatar = !!myAvatar?.avatarUrl;
  const latestGeneratedImages = useMemo(() => {
    if (lastGeneratedImages.length > 0) {
      return lastGeneratedImages;
    }

    const historyEntry = avatarHistory?.[0];
    if (!historyEntry) {
      return [];
    }

    if (historyEntry.imageUrls && historyEntry.imageUrls.length > 0) {
      return historyEntry.imageUrls;
    }

    if (historyEntry.imageUrl) {
      return [historyEntry.imageUrl];
    }

    return [];
  }, [avatarHistory, lastGeneratedImages]);

  const canSelectFromGallery = Boolean(playerAddress && hasDisplayName);

  return (
    <section className="w-full mb-2 max-w-2xl space-y-4 overflow-y-auto rounded-3xl border border-white/10 bg-black/60 p-5 text-white/90 shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl max-h-[70vh] sm:max-w-3xl sm:space-y-5 sm:p-6 sm:max-h-[72vh] xl:max-h-[70vh] xl:space-y-6 xl:p-7 2xl:max-h-[86vh] 2xl:max-w-4xl 2xl:p-8">
      {/* Avatar Management Section */}
      {playerAddress && showAvatarSection && (
        <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gold flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Personalized Avatar
            </h3>
            <button
              onClick={() => setShowAvatarSection(false)}
              className="text-white/40 hover:text-white/70 transition-colors text-xs"
            >
              Hide
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Avatar Preview */}
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <div className="w-48 h-48 rounded-xl overflow-hidden border-2 border-gold/30 shadow-xl bg-brown/30">
                {isLoadingAvatarOrAccount ? (
                  <div className="h-full w-full flex items-center justify-center bg-gold/10">
                    <Loader2 className="w-8 h-8 animate-spin text-gold" />
                  </div>
                ) : (
                  <img className="h-full w-full object-cover" src={currentAvatarUrl} alt="Your avatar" />
                )}
              </div>
              {myAvatar && myAvatar.generationCount !== undefined && (
                <p className="text-sm text-white/50 text-center mt-3">
                  {myAvatar.generationCount} / 1 weekly generation
                </p>
              )}
            </div>

            {/* Avatar Controls */}
            <div className="flex-1 space-y-3 w-full">
              <Tabs
                variant="selection"
                selectedIndex={avatarTabIndex}
                onChange={(index) => setAvatarTabIndex(index)}
                className="space-y-3"
              >
                <Tabs.List className="grid grid-cols-2 gap-2">
                  <Tabs.Tab className="!mx-0 text-xs">Generate</Tabs.Tab>
                  <Tabs.Tab className="!mx-0 text-xs">Gallery</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panels className="flex-1">
                  <Tabs.Panel className="space-y-3">
                    <div>
                      <label className="text-xs text-white/60 block mb-1.5">
                        Describe your avatar (e.g., \"cyberpunk warrior\")
                      </label>
                      <TextInput
                        value={avatarPrompt}
                        onChange={(value) => setAvatarPrompt(value)}
                        placeholder="Enter description..."
                        className="w-full"
                        disabled={generateAvatar.isPending}
                        maxLength={500}
                      />
                    </div>

                    {generateAvatar.isError && (
                      <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-2 py-1.5">
                        {(generateAvatar.error as any)?.message || "Failed to generate avatar"}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={handleGenerateAvatar}
                        variant="gold"
                        className="flex-1 justify-center gap-2 !px-3 !py-1.5"
                        forceUppercase={false}
                        isLoading={generateAvatar.isPending}
                        disabled={generateAvatar.isPending || !avatarPrompt.trim() || !hasDisplayName}
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {generateAvatar.isPending ? "Generating..." : hasCustomAvatar ? "Regenerate" : "Generate"}
                        </span>
                      </Button>

                      {hasCustomAvatar && (
                        <Button
                          onClick={handleDeleteAvatar}
                          variant="outline"
                          className="justify-center gap-2 !px-3 !py-1.5"
                          forceUppercase={false}
                          isLoading={deleteAvatar.isPending}
                          disabled={deleteAvatar.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </Button>
                      )}
                    </div>

                    {latestGeneratedImages.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-white/50">Latest generation</p>
                        <AvatarImageGrid
                          images={latestGeneratedImages}
                          selectedUrl={myAvatar?.avatarUrl}
                          onSelect={handleSelectAvatar}
                          isSelecting={selectAvatar.isPending}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-white/50">Generate an avatar to see your options.</p>
                    )}

                    {!hasDisplayName && (
                      <p className="text-xs text-yellow-400/80">
                        Connect with Cartridge to create a custom avatar
                      </p>
                    )}
                  </Tabs.Panel>

                  <Tabs.Panel className="space-y-3">
                    {isGalleryLoading ? (
                      <div className="flex items-center justify-center rounded-lg border border-gold/20 bg-gold/5 py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-gold" />
                      </div>
                    ) : galleryItems && galleryItems.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {galleryItems.map((item, index) => {
                          const isOwnImage = Boolean(
                            item.cartridgeUsername && item.cartridgeUsername === displayName,
                          );
                          const isSelected = myAvatar?.avatarUrl === item.imageUrl;
                          const canSelect = canSelectFromGallery && isOwnImage;

                          return (
                            <div key={`${item.imageUrl}-${index}`} className="space-y-1">
                              <button
                                type="button"
                                className={`group relative w-full overflow-hidden rounded-lg border bg-black/20 transition ${
                                  isSelected
                                    ? "border-gold/70"
                                    : "border-gold/20 hover:border-gold/40"
                                } ${!canSelect || isSelected ? "cursor-default" : ""}`}
                                onClick={() => {
                                  if (!canSelect || isSelected) return;
                                  void handleSelectAvatar(item.imageUrl);
                                }}
                                disabled={!canSelect || isSelected || selectAvatar.isPending}
                                aria-pressed={isSelected}
                              >
                                <img className="h-24 w-full object-cover" src={item.imageUrl} alt={item.prompt} />
                                {canSelect && (
                                  <div
                                    className={`absolute inset-0 flex items-end justify-center pb-2 text-[11px] font-semibold uppercase tracking-wide ${
                                      isSelected
                                        ? "bg-black/55 text-gold"
                                        : "bg-black/0 text-transparent group-hover:bg-black/40 group-hover:text-gold"
                                    }`}
                                  >
                                    {isSelected ? "Active" : "Use"}
                                  </div>
                                )}
                              </button>
                              <p className="text-[11px] text-white/50 truncate">{item.prompt}</p>
                              {item.cartridgeUsername && (
                                <p className="text-[10px] text-white/40">@{item.cartridgeUsername}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-white/50">No creations yet. Be the first to generate.</p>
                    )}
                  </Tabs.Panel>
                </Tabs.Panels>
              </Tabs>
            </div>
          </div>
        </div>
      )}

      {!showAvatarSection && playerAddress && (
        <button
          onClick={() => setShowAvatarSection(true)}
          className="w-full text-center text-sm text-gold/60 hover:text-gold transition-colors py-2 rounded-lg border border-gold/10 hover:border-gold/30 bg-gold/5 hover:bg-gold/10"
        >
          Show Avatar Management
        </button>
      )}

      {isPlayerLoading ? (
        <div className="space-y-4" aria-busy aria-live="polite">
          <div className="h-20 animate-pulse rounded-2xl border border-white/5 bg-white/5" />
          <div className="h-36 animate-pulse rounded-2xl border border-white/5 bg-white/5" />
        </div>
      ) : playerError ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200" role="alert">
          <p className="font-semibold text-red-100">Leaderboard unavailable</p>
          <p className="mt-1 text-red-200/80">{playerError}</p>
          <div className="mt-3 flex items-center justify-end gap-2">
            {isRefreshing ? (
              <span className="text-xs text-white/70" aria-live="polite">
                Refreshing…
              </span>
            ) : isCooldownActive ? (
              <span className="text-xs text-white/50" aria-live="polite">
                Wait {refreshSecondsLeft}s
              </span>
            ) : null}
            <RefreshButton
              onClick={handleRefresh}
              isLoading={isRefreshing}
              disabled={isCooldownActive || isRefreshing}
              size="md"
              aria-label="Refresh your Blitz standings"
            />
          </div>
        </div>
      ) : statusMessage ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80" role="status">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{statusMessage}</p>
            <div className="flex items-center gap-2">
              {isRefreshing ? (
                <span className="text-xs text-white/70" aria-live="polite">
                  Refreshing…
                </span>
              ) : isCooldownActive ? (
                <span className="text-xs text-white/50" aria-live="polite">
                  Wait {refreshSecondsLeft}s
                </span>
              ) : null}
              <RefreshButton
                onClick={handleRefresh}
                isLoading={isRefreshing}
                disabled={isCooldownActive || isRefreshing}
                size="md"
                aria-label="Refresh your Blitz standings"
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {/* Filler span pushes refresh button to right in row layout */}
            <div className="flex items-center justify-between w-full">
              <div />
              <div className="flex items-center gap-2">
                {isRefreshing ? (
                  <span className="text-xs text-white/70" aria-live="polite">
                    Refreshing…
                  </span>
                ) : isCooldownActive ? (
                  <span className="text-xs text-white/50" aria-live="polite">
                    Wait {refreshSecondsLeft}s
                  </span>
                ) : null}
                <RefreshButton
                  onClick={handleRefresh}
                  isLoading={isRefreshing}
                  disabled={isCooldownActive || isRefreshing}
                  size="md"
                  aria-label="Refresh your Blitz standings"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-center sm:mt-5 xl:mt-6">
            {highlightPlayer ? (
              <div className="w-full max-w-[420px] sm:max-w-[620px] xl:max-w-[780px] 2xl:max-w-[940px]" ref={cardRef}>
                <BlitzHighlightCardWithSelector
                  title="Realms Blitz"
                  subtitle="Blitz Leaderboard"
                  winnerLine={championLabel}
                  highlight={highlightPlayer}
                />
              </div>
            ) : (
              <div className="flex h-[170px] w-full max-w-[420px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xs text-white/60 sm:h-[190px] sm:max-w-[520px] sm:text-sm xl:max-w-[580px] xl:text-sm 2xl:max-w-[720px] 2xl:h-[220px]">
                Final standings will appear once the next Blitz round completes.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:gap-2.5 md:flex-row xl:mt-6">
            <Button
              onClick={handleCopyImage}
              variant="gold"
              className="w-full flex-1 justify-center gap-2 !px-4 !py-2 sm:!py-2.5 xl:!py-3 md:!px-6"
              forceUppercase={false}
              isLoading={isCopyingImage}
              disabled={isCopyingImage || !highlightPlayer}
            >
              <Copy className="h-4 w-4" />
              <span>{isCopyingImage ? "Preparing image…" : "Copy highlight image"}</span>
            </Button>
            <Button
              onClick={handleShareOnX}
              variant="outline"
              className="w-full flex-1 justify-center gap-2 !px-4 !py-2 sm:!py-2.5 xl:!py-3 md:!px-6"
              forceUppercase={false}
              disabled={!highlightPlayer}
            >
              <Share2 className="h-4 w-4" />
              <span>Share on X</span>
            </Button>
            <Button
              onClick={handleCopyMessage}
              variant="secondary"
              className="w-full flex-1 justify-center gap-2 !px-4 !py-2 sm:!py-2.5 xl:!py-3 md:!px-6"
              forceUppercase={false}
            >
              <Copy className="h-4 w-4" />
              <span>Copy message</span>
            </Button>
          </div>
        </>
      )}
    </section>
  );
};
