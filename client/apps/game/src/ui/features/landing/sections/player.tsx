import { useCallback, useEffect, useMemo, useState } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useCartridgeUsername } from "@/hooks/use-cartridge-username";
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
import { Tabs } from "@/ui/design-system/atoms/tab";
import { AvatarImageGrid } from "@/ui/features/avatars/avatar-image-grid";
import { displayAddress } from "@/ui/utils/utils";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { toast } from "sonner";

import { hash } from "starknet";

import { LandingWorldSelector } from "../components/landing-world-selector";
import { useLandingWorldSelection } from "../lib/use-landing-world-selection";

// MMR fetching utilities
const GET_PLAYER_MMR_SELECTOR = hash.getSelectorFromName("get_player_mmr");
const WORLD_CONFIG_QUERY = `SELECT "mmr_config.mmr_token_address" AS mmr_token_address FROM "s1_eternum-WorldConfig" LIMIT 1;`;

const parseMaybeHexToBigInt = (v: unknown): bigint | null => {
  if (v == null) return null;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return BigInt(v);
      return BigInt(v);
    } catch {
      return null;
    }
  }
  return null;
};

const toHexString = (value: bigint | number | string): string => {
  if (typeof value === "string") {
    return value.startsWith("0x") ? value : `0x${BigInt(value).toString(16)}`;
  }
  return `0x${BigInt(value).toString(16)}`;
};

export const LandingPlayer = () => {
  const account = useAccountStore((state) => state.account);
  const accountName = useAccountStore((state) => state.accountName);
  const playerAddress = account?.address && account.address !== "0x0" ? account.address : null;

  const { username: cartridgeUsername, isLoading: isCartridgeUsernameLoading } = useCartridgeUsername();
  const displayName = accountName || cartridgeUsername || "";
  const hasDisplayName = Boolean(displayName);
  const playerId = playerAddress ?? "";

  // World selection for player section
  const worldSelection = useLandingWorldSelection({ storageKeyPrefix: "player" });

  // MMR state
  const [playerMMR, setPlayerMMR] = useState<bigint | null>(null);
  const [isLoadingMMR, setIsLoadingMMR] = useState(false);

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
  const dailyGenerationLimit = 1;
  const hasReachedDailyLimit = (myAvatar?.generationCount ?? 0) >= dailyGenerationLimit;
  const resetCountdownLabel = useMemo(() => {
    if (!myAvatar?.nextResetAt) return null;
    const resetAt = new Date(myAvatar.nextResetAt);
    if (Number.isNaN(resetAt.getTime())) return null;
    const diffMs = resetAt.getTime() - Date.now();
    if (diffMs <= 0) return null;
    const totalMinutes = Math.ceil(diffMs / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }, [myAvatar?.nextResetAt]);

  // Fetch player MMR from the current world
  useEffect(() => {
    if (!playerAddress) {
      setPlayerMMR(null);
      setIsLoadingMMR(false);
      return;
    }

    const worldName = worldSelection.selectedWorld;
    if (!worldName) {
      setPlayerMMR(null);
      setIsLoadingMMR(false);
      return;
    }

    let cancelled = false;
    const fetchMMR = async () => {
      const toriiUrl = `https://api.cartridge.gg/x/${worldName}/torii`;
      const rpcUrl = `https://api.cartridge.gg/x/${worldName}/katana`;

      setIsLoadingMMR(true);
      setPlayerMMR(null);

      try {
        // 1. Fetch MMR token address from WorldConfig
        const configUrl = `${toriiUrl}/sql?query=${encodeURIComponent(WORLD_CONFIG_QUERY)}`;
        const configResponse = await fetch(configUrl);
        if (!configResponse.ok || cancelled) {
          if (!cancelled) setIsLoadingMMR(false);
          return;
        }
        const [configRow] = (await configResponse.json()) as Record<string, unknown>[];
        const mmrTokenAddressRaw = parseMaybeHexToBigInt(configRow?.mmr_token_address);
        if (!mmrTokenAddressRaw || mmrTokenAddressRaw === 0n || cancelled) {
          if (!cancelled) setIsLoadingMMR(false);
          return;
        }
        const mmrTokenAddress = toHexString(mmrTokenAddressRaw);

        // 2. Fetch player's MMR via JSON-RPC
        const rpcResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "starknet_call",
            params: [
              {
                contract_address: mmrTokenAddress,
                entry_point_selector: GET_PLAYER_MMR_SELECTOR,
                calldata: [playerAddress],
              },
              "pending",
            ],
          }),
        });

        if (!rpcResponse.ok || cancelled) {
          if (!cancelled) setIsLoadingMMR(false);
          return;
        }

        const rpcResult = await rpcResponse.json();
        if (cancelled) return;

        if (rpcResult.error || !rpcResult.result) {
          setIsLoadingMMR(false);
          return;
        }

        // u256 is returned as two felts [low, high]
        const low = BigInt(rpcResult.result[0] || "0");
        const high = BigInt(rpcResult.result[1] || "0");
        const mmr = low + (high << 128n);

        setPlayerMMR(mmr);
        setIsLoadingMMR(false);
      } catch (e) {
        console.warn("Failed to fetch player MMR:", e);
        if (!cancelled) setIsLoadingMMR(false);
      }
    };

    void fetchMMR();

    return () => {
      cancelled = true;
    };
  }, [playerAddress, worldSelection.selectedWorld]);

  // Format MMR for display (convert from token units with 18 decimals)
  const formattedMMR = useMemo(() => {
    if (playerMMR === null) return null;
    const mmrValue = playerMMR / 10n ** 18n;
    return mmrValue.toString();
  }, [playerMMR]);

  const handleGenerateAvatar = useCallback(async () => {
    if (!avatarPrompt.trim()) {
      toast.error("Please enter a description for your avatar.");
      return;
    }
    if (hasReachedDailyLimit) {
      toast.error("Daily avatar generation limit reached. Try again later.");
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
  }, [avatarPrompt, generateAvatar, hasReachedDailyLimit]);

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
    <section className="w-full mb-2 max-w-3xl space-y-4 overflow-y-auto rounded-3xl border border-white/10 bg-black/60 p-5 text-white/90 shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl max-h-[70vh] sm:max-w-4xl sm:space-y-5 sm:p-6 sm:max-h-[72vh] xl:max-h-[70vh] xl:max-w-5xl xl:space-y-6 xl:p-7 2xl:max-h-[86vh] 2xl:max-w-6xl 2xl:p-8">
      {/* World Selector */}
      <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4">
        <LandingWorldSelector
          selectedChain={worldSelection.selectedChain}
          selectedWorld={worldSelection.selectedWorld}
          availableWorlds={worldSelection.availableWorlds}
          isLoading={worldSelection.isLoading}
          isCheckingAvailability={worldSelection.isCheckingAvailability}
          onChainChange={worldSelection.setSelectedChain}
          onWorldChange={worldSelection.setSelectedWorld}
        />
        {worldSelection.selectedWorld && (
          <p className="mt-2 text-xs text-gold/60">
            Showing data from: <span className="font-semibold text-gold">{worldSelection.selectedWorld}</span>
          </p>
        )}
      </div>

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
                  {myAvatar.generationCount} / {dailyGenerationLimit} daily generation
                </p>
              )}
              {hasReachedDailyLimit && (
                <p className="text-xs text-amber-200/80 text-center mt-1">
                  Daily generation limit reached. <br />
                  {resetCountdownLabel ? ` Next reset in ${resetCountdownLabel}.` : ""}
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
                        disabled={
                          generateAvatar.isPending || !avatarPrompt.trim() || !hasDisplayName || hasReachedDailyLimit
                        }
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
                      <p className="text-xs text-yellow-400/80">Connect with Cartridge to create a custom avatar</p>
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
                          const isOwnImage = Boolean(item.cartridgeUsername && item.cartridgeUsername === displayName);
                          const isSelected = myAvatar?.avatarUrl === item.imageUrl;
                          const canSelect = canSelectFromGallery && isOwnImage;

                          return (
                            <div key={`${item.imageUrl}-${index}`} className="space-y-1">
                              <button
                                type="button"
                                className={`group relative w-full overflow-hidden rounded-lg border bg-black/20 transition ${
                                  isSelected ? "border-gold/70" : "border-gold/20 hover:border-gold/40"
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

      {/* Player MMR Display */}
      {playerAddress ? (
        <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/10 to-transparent p-6">
          <div className="flex flex-col items-center gap-4 text-center">
            {isLoadingMMR ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-gold" />
                <span className="text-gold/70">Loading MMR...</span>
              </div>
            ) : playerMMR !== null && playerMMR > 0n ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-lg text-gold/70">Your MMR:</span>
                  <span className="text-4xl font-bold text-gold">{formattedMMR}</span>
                </div>
                <p className="text-sm text-gold/60">
                  Your ranking score for {worldSelection.selectedWorld || "this world"}
                </p>
              </>
            ) : (
              <>
                <span className="text-lg text-gold/70">No MMR yet</span>
                <p className="text-sm text-gold/60">Play a Blitz round to earn MMR and climb the leaderboard!</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-white/70">Connect a wallet to view your profile and MMR.</p>
        </div>
      )}
    </section>
  );
};
