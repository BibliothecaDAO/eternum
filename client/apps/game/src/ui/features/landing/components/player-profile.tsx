import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useCartridgeUsername } from "@/hooks/use-cartridge-username";
import {
  getAvatarUrl,
  normalizeAvatarAddress,
  useAvatarGallery,
  useAvatarHistory,
  useDeleteAvatar,
  useGenerateAvatar,
  useMyAvatar,
  usePlayerAvatar,
  useSelectAvatar,
} from "@/hooks/use-player-avatar";
import { fetchLandingLeaderboardEntryByAddress } from "@/services/leaderboard/landing-leaderboard-service";
import TextInput from "@/ui/design-system/atoms/text-input";

import { MMR_TOKEN_BY_CHAIN } from "@/config/global-chain";
import { Button } from "@/ui/design-system/atoms";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { AvatarImageGrid } from "@/ui/features/avatars/avatar-image-grid";
import { MMRTierBadge } from "@/ui/shared/components/mmr-tier-badge";
import { copyElementAsPng, openShareOnX } from "@/ui/shared/lib/share-image";
import {
  getMMRTierFromRaw,
  getNextTier,
  getTierProgress,
  MMR_TOKEN_DECIMALS,
  toMmrIntegerFromRaw,
} from "@/ui/utils/mmr-tiers";
import type { MMRTier } from "@/ui/utils/mmr-tiers";
import { displayAddress } from "@/ui/utils/utils";
import { toHexString } from "@bibliothecadao/eternum";
import type { Chain } from "@contracts";
import { motion, AnimatePresence } from "framer-motion";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Copy from "lucide-react/dist/esm/icons/copy";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { toast } from "sonner";

import { hash } from "starknet";
import { dojoConfig } from "../../../../../dojo-config";
import { env } from "../../../../../env";

// MMR fetching utilities
const GET_PLAYER_MMR_SELECTOR = hash.getSelectorFromName("get_player_mmr");
const CHAIN_OPTIONS: Chain[] = ["slot", "mainnet"];
const DEFAULT_CHAIN: Chain = "slot";
const MAINNET_COMING_SOON = true;
const MMR_CHAIN_STORAGE_KEY = "landing-player-mmr-chain";

const RPC_FALLBACK_BY_CHAIN: Partial<Record<Chain, string>> = {
  slot: "https://api.cartridge.gg/x/eternum-blitz-slot-3/katana/rpc/v0_9",
};

// Map tier color classes to actual hex values for gradients/glows
const TIER_COLOR_HEX: Record<string, string> = {
  "text-relic2": "#c084f5",
  "text-light-red": "#EF5858",
  "text-blueish": "#6B7FD7",
  "text-brilliance": "#7DFFBA",
  "text-gold": "#dfaa54",
  "text-light-pink": "#CAB1A6",
  "text-orange": "#FE993C",
  "text-gray-gold": "#776756",
};

const getTierHex = (tier: MMRTier | null): string => {
  if (!tier) return "#dfaa54";
  return TIER_COLOR_HEX[tier.color] || "#dfaa54";
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
};

interface LandingPlayerProps {
  selectedPlayerAddress?: string | null;
  selectedPlayerName?: string | null;
  variant?: "full" | "trimmed";
}

const getNormalizedProfileAddress = (address: string | null | undefined): string | null => {
  const normalized = normalizeAvatarAddress(address);
  if (!normalized) return null;
  if (normalized === "0x0") return null;
  return normalized;
};

// Animated number using requestAnimationFrame (ref-based to avoid setState-in-effect lint).
// Inner span is targeted by rAF so framer-motion on the outer span doesn't conflict.
const AnimatedMMR = ({ value }: { value: string }) => {
  const targetValue = parseInt(value, 10) || 0;
  const innerRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    if (targetValue <= 0) {
      el.textContent = "0";
      return;
    }

    const duration = 1200;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(targetValue * eased).toLocaleString();
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetValue]);

  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="tabular-nums"
    >
      <span ref={innerRef}>0</span>
    </motion.span>
  );
};

export const LandingPlayer = ({ selectedPlayerAddress, selectedPlayerName, variant = "full" }: LandingPlayerProps) => {
  const account = useAccountStore((state) => state.account);
  const accountName = useAccountStore((state) => state.accountName);
  const connectedPlayerAddress = account?.address && account.address !== "0x0" ? account.address : null;
  const normalizedConnectedAddress = getNormalizedProfileAddress(connectedPlayerAddress);
  const normalizedSelectedAddress = getNormalizedProfileAddress(selectedPlayerAddress);
  const viewedPlayerAddress = normalizedSelectedAddress ?? normalizedConnectedAddress;
  const isOwnProfile = viewedPlayerAddress != null && viewedPlayerAddress === normalizedConnectedAddress;

  const { username: cartridgeUsername, isLoading: isCartridgeUsernameLoading } = useCartridgeUsername();
  const ownDisplayName = accountName || cartridgeUsername || "";
  const hasOwnDisplayName = Boolean(ownDisplayName);
  const playerId = connectedPlayerAddress ?? "";
  const [resolvedPlayerName, setResolvedPlayerName] = useState<string | null>(null);

  const selectedPlayerNameTrimmed = selectedPlayerName?.trim() || null;
  const externalPlayerName = selectedPlayerNameTrimmed || resolvedPlayerName;
  const displayName = isOwnProfile
    ? ownDisplayName || "Anonymous"
    : externalPlayerName || (viewedPlayerAddress ? displayAddress(viewedPlayerAddress) : "Anonymous");
  const isTrimmed = variant === "trimmed";

  const [selectedChain, setSelectedChain] = useState<Chain>(DEFAULT_CHAIN);

  // MMR state
  const [playerMMR, setPlayerMMR] = useState<bigint | null>(null);
  const [isLoadingMMR, setIsLoadingMMR] = useState(false);
  const profileCardRef = useRef<HTMLDivElement>(null);
  const [isCopyingProfileCard, setIsCopyingProfileCard] = useState(false);

  const rpcUrl = useMemo(() => {
    if (selectedChain === "slot") {
      return dojoConfig.rpcUrl || env.VITE_PUBLIC_NODE_URL || RPC_FALLBACK_BY_CHAIN.slot;
    }
    return RPC_FALLBACK_BY_CHAIN[selectedChain];
  }, [selectedChain]);

  const mmrTokenAddress = useMemo(() => MMR_TOKEN_BY_CHAIN[selectedChain], [selectedChain]);

  useEffect(() => {
    if (!viewedPlayerAddress || isOwnProfile || selectedPlayerNameTrimmed) {
      setResolvedPlayerName(null);
      return;
    }

    let cancelled = false;
    const loadPlayerName = async () => {
      try {
        const entry = await fetchLandingLeaderboardEntryByAddress(viewedPlayerAddress);
        if (cancelled) return;
        setResolvedPlayerName(entry?.displayName?.trim() || null);
      } catch {
        if (cancelled) return;
        setResolvedPlayerName(null);
      }
    };

    void loadPlayerName();

    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, selectedPlayerNameTrimmed, viewedPlayerAddress]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedChain = window.localStorage.getItem(MMR_CHAIN_STORAGE_KEY);
    if (storedChain && CHAIN_OPTIONS.includes(storedChain as Chain)) {
      if (storedChain === "mainnet" && MAINNET_COMING_SOON) {
        setSelectedChain("slot");
        return;
      }
      setSelectedChain(storedChain as Chain);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MMR_CHAIN_STORAGE_KEY, selectedChain);
  }, [selectedChain]);

  // Avatar management
  const [avatarPrompt, setAvatarPrompt] = useState("");
  const [showAvatarSection, setShowAvatarSection] = useState(false);
  const [avatarTabIndex, setAvatarTabIndex] = useState(0);
  const [lastGeneratedImages, setLastGeneratedImages] = useState<string[]>([]);
  const { data: myAvatar, isLoading: isLoadingAvatar } = useMyAvatar(playerId, playerId, ownDisplayName);
  const { data: avatarHistory } = useAvatarHistory(playerId, playerId, ownDisplayName, 1);
  const { data: galleryItems, isLoading: isGalleryLoading } = useAvatarGallery(40);
  const { data: viewedAvatar, isLoading: isLoadingViewedAvatar } = usePlayerAvatar(viewedPlayerAddress);

  const generateAvatar = useGenerateAvatar(playerId, playerId, ownDisplayName);
  const deleteAvatar = useDeleteAvatar(playerId, playerId, ownDisplayName);
  const selectAvatar = useSelectAvatar(playerId, playerId, ownDisplayName);
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

  // Fetch global player MMR from the selected chain
  useEffect(() => {
    if (!viewedPlayerAddress) {
      setPlayerMMR(null);
      setIsLoadingMMR(false);
      return;
    }

    if (!rpcUrl || !mmrTokenAddress) {
      setPlayerMMR(null);
      setIsLoadingMMR(false);
      return;
    }

    let cancelled = false;
    const fetchMMR = async () => {
      setIsLoadingMMR(true);
      setPlayerMMR(null);

      try {
        let normalizedPlayerAddress = viewedPlayerAddress;
        try {
          normalizedPlayerAddress = toHexString(BigInt(viewedPlayerAddress));
        } catch {
          // Keep the original address if normalization fails.
        }

        const batchRequest = [
          {
            jsonrpc: "2.0",
            id: 0,
            method: "starknet_call",
            params: [
              {
                contract_address: mmrTokenAddress,
                entry_point_selector: GET_PLAYER_MMR_SELECTOR,
                calldata: [normalizedPlayerAddress],
              },
              "pre_confirmed",
            ],
          },
        ];

        const rpcResponse = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batchRequest),
        });

        if (!rpcResponse.ok) {
          throw new Error(`RPC request failed: ${rpcResponse.status}`);
        }

        const rpcResult = await rpcResponse.json();
        if (cancelled) return;

        const resultsArray = Array.isArray(rpcResult) ? rpcResult : [rpcResult];
        const result = resultsArray.find((entry: { id?: number }) => entry?.id === 0) ?? resultsArray[0];

        if (result?.error || !result?.result) {
          return;
        }

        // u256 is returned as two felts [low, high]
        const resultArray = result.result as string[];
        const low = BigInt(resultArray[0] || "0");
        const high = BigInt(resultArray[1] || "0");
        const mmr = low + (high << 128n);

        setPlayerMMR(mmr);
      } catch (e) {
        console.warn("Failed to fetch player MMR:", e);
      } finally {
        if (!cancelled) setIsLoadingMMR(false);
      }
    };

    void fetchMMR();

    return () => {
      cancelled = true;
    };
  }, [mmrTokenAddress, rpcUrl, viewedPlayerAddress]);

  // Format MMR for display (convert from token units with 18 decimals)
  const formattedMMR = useMemo(() => {
    if (playerMMR === null) return null;
    const mmrValue = playerMMR / MMR_TOKEN_DECIMALS;
    return mmrValue.toString();
  }, [playerMMR]);

  const playerTier = useMemo(() => {
    if (playerMMR === null || playerMMR <= 0n) return null;
    return getMMRTierFromRaw(playerMMR);
  }, [playerMMR]);

  const mmrInteger = useMemo(() => {
    if (playerMMR === null) return 0;
    return toMmrIntegerFromRaw(playerMMR);
  }, [playerMMR]);

  const nextTier = useMemo(() => {
    if (!playerTier) return null;
    return getNextTier(playerTier);
  }, [playerTier]);

  const tierProgress = useMemo(() => {
    if (!playerTier) return 0;
    return getTierProgress(mmrInteger, playerTier);
  }, [mmrInteger, playerTier]);

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
    } catch (error: unknown) {
      console.error("Failed to generate avatar:", error);
      toast.error(getErrorMessage(error, "Failed to generate avatar. Please try again."));
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

      if (!connectedPlayerAddress || !hasOwnDisplayName) {
        toast.error("Connect with Cartridge to select an avatar.");
        return;
      }

      try {
        await selectAvatar.mutateAsync(imageUrl);
        toast.success("Avatar updated.");
      } catch (error: unknown) {
        console.error("Failed to set avatar:", error);
        toast.error(getErrorMessage(error, "Failed to set avatar. Please try again."));
      }
    },
    [connectedPlayerAddress, hasOwnDisplayName, myAvatar?.avatarUrl, selectAvatar],
  );

  const isLoadingAvatarOrAccount = isOwnProfile
    ? isLoadingAvatar || (Boolean(connectedPlayerAddress) && !hasOwnDisplayName && isCartridgeUsernameLoading)
    : isLoadingViewedAvatar;

  const currentAvatarUrl = useMemo(() => {
    if (!viewedPlayerAddress) {
      return getAvatarUrl("", null);
    }
    if (isOwnProfile) {
      return getAvatarUrl(viewedPlayerAddress, myAvatar?.avatarUrl);
    }
    return getAvatarUrl(viewedPlayerAddress, viewedAvatar?.avatarUrl);
  }, [isOwnProfile, myAvatar?.avatarUrl, viewedAvatar?.avatarUrl, viewedPlayerAddress]);
  const profileAvatarAlt = isOwnProfile ? "Your avatar" : `${displayName} avatar`;
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

  const canSelectFromGallery = Boolean(isOwnProfile && connectedPlayerAddress && hasOwnDisplayName);
  const tierHex = getTierHex(playerTier);
  const nextTierHex = getTierHex(nextTier);
  const mmrShareLabel = useMemo(() => {
    if (!formattedMMR) return null;
    const parsed = Number(formattedMMR);
    if (Number.isFinite(parsed)) {
      return parsed.toLocaleString();
    }
    return formattedMMR;
  }, [formattedMMR]);

  const profileShareMessage = useMemo(() => {
    const shareName = (displayName || "Anonymous").trim();
    const tierLabel = playerTier?.name ?? "Unranked";
    const mmrLabel = mmrShareLabel ? `${mmrShareLabel} MMR` : "No MMR yet";
    const profileUrl = (() => {
      if (typeof window === "undefined") {
        return "https://blitz.realms.world/profile";
      }

      const url = new URL("/profile", window.location.origin);
      if (!isOwnProfile && viewedPlayerAddress) {
        url.searchParams.set("player", viewedPlayerAddress);
      }
      return url.toString();
    })();

    const profileTitle = isOwnProfile ? "My Realms Blitz profile" : "Realms Blitz profile";

    return `${profileTitle}\n\nPlayer: ${shareName}\nTier: ${tierLabel}\nMMR: ${mmrLabel}\n${profileUrl}\n\n#RealmsBlitz #Eternum`;
  }, [displayName, isOwnProfile, mmrShareLabel, playerTier?.name, viewedPlayerAddress]);

  const handleCopyProfilePng = useCallback(async () => {
    if (!profileCardRef.current) {
      toast.error("Profile card is still loading.");
      return;
    }

    setIsCopyingProfileCard(true);
    try {
      const result = await copyElementAsPng({
        element: profileCardRef.current,
        filename: `realms-profile-${Date.now()}.png`,
        backgroundColor: "#030d14",
        pixelRatio: 2,
      });

      if (result === "copied") {
        toast.success("Profile image copied to clipboard!");
      } else {
        toast.info("Clipboard not available; downloaded image instead.");
      }
    } catch (error) {
      console.error("Failed to copy profile image", error);
      toast.error("Copy failed. Please try again.");
    } finally {
      setIsCopyingProfileCard(false);
    }
  }, []);

  const handleShareProfileOnX = useCallback(() => {
    const didOpen = openShareOnX(profileShareMessage);
    if (!didOpen) {
      toast.error("Sharing is not supported in this environment.");
    }
  }, [profileShareMessage]);

  // --- Not connected state ---
  if (!viewedPlayerAddress) {
    return (
      <section className="w-full max-w-2xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/50 p-10 text-center backdrop-blur-xl">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(223,170,84,0.5) 10px, rgba(223,170,84,0.5) 11px)",
            }}
          />
          <div className="relative space-y-4">
            <div className="mx-auto h-20 w-20 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center">
              <div className="h-10 w-10 rounded-full border border-gold/20 bg-gold/5" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-white/80">Connect your wallet</p>
              <p className="text-sm text-white/40">to view your profile, rank, and avatar</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full mb-2 max-w-3xl space-y-3 overflow-y-auto rounded-2xl border border-white/[0.08] bg-black/50 p-5 text-white/90 backdrop-blur-xl max-h-[70vh] sm:max-w-4xl sm:space-y-4 sm:p-6 sm:max-h-[72vh] xl:max-h-[70vh] xl:max-w-5xl xl:p-7 2xl:max-h-[86vh] 2xl:max-w-6xl 2xl:p-8">
      {/* ═══ HERO PLAYER CARD ═══ */}
      <div className="space-y-3">
        <div ref={profileCardRef} className="relative overflow-hidden rounded-2xl border border-white/[0.06]">
          {/* Tier-colored ambient glow */}
          <div
            className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-[100px] opacity-20 transition-colors duration-700"
            style={{ backgroundColor: tierHex }}
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full blur-[80px] opacity-10 transition-colors duration-700"
            style={{ backgroundColor: tierHex }}
          />

          {/* Fine diagonal line texture */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(223,170,84,0.6) 8px, rgba(223,170,84,0.6) 9px)",
            }}
          />

          <div className="relative p-5 sm:p-6 xl:p-7">
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-7">
              {/* Avatar */}
              <motion.div
                className="relative flex-shrink-0 mx-auto sm:mx-0 group"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <div
                  className="absolute -inset-1 rounded-xl opacity-30 blur-md transition-opacity duration-500 group-hover:opacity-50"
                  style={{ backgroundColor: tierHex }}
                />
                <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-xl overflow-hidden border border-white/10 bg-brown/40">
                  {isLoadingAvatarOrAccount ? (
                    <div className="h-full w-full flex items-center justify-center bg-white/[0.03]">
                      <Loader2 className="w-6 h-6 animate-spin text-gold/60" />
                    </div>
                  ) : (
                    <img
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      src={currentAvatarUrl}
                      alt={profileAvatarAlt}
                    />
                  )}
                </div>
              </motion.div>

              {/* Identity + Rank */}
              <div className="flex-1 flex flex-col justify-center text-center sm:text-left gap-3">
                {/* Name + Chain */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <motion.h2
                    className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                  >
                    {displayName || "Anonymous"}
                  </motion.h2>
                  <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                    {CHAIN_OPTIONS.map((chain) => {
                      const isComingSoon = MAINNET_COMING_SOON && chain === "mainnet";
                      const isSelected = selectedChain === chain;

                      return (
                        <button
                          key={chain}
                          type="button"
                          disabled={isComingSoon}
                          onClick={() => setSelectedChain(chain)}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-medium capitalize transition-all duration-150 ${
                            isComingSoon
                              ? "cursor-not-allowed text-white/20"
                              : isSelected
                                ? "bg-white/[0.08] text-white/70"
                                : "text-white/30 hover:text-white/50"
                          }`}
                        >
                          {chain}
                          {isComingSoon && <span className="ml-1 text-[9px] text-white/15">soon</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* MMR + Tier */}
                {isLoadingMMR ? (
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gold/40 border-t-transparent" />
                    <span className="text-sm text-white/30">Loading rank...</span>
                  </div>
                ) : playerMMR !== null && playerMMR > 0n ? (
                  <div className="space-y-3">
                    {/* MMR value + tier badge */}
                    <div className="flex items-baseline gap-3 justify-center sm:justify-start">
                      <span className="text-4xl sm:text-5xl font-black tracking-tighter" style={{ color: tierHex }}>
                        {formattedMMR && <AnimatedMMR value={formattedMMR} />}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-widest text-white/30">MMR</span>
                      {playerTier && (
                        <motion.div
                          className="ml-1"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.3 }}
                        >
                          <MMRTierBadge tier={playerTier} size="md" />
                        </motion.div>
                      )}
                    </div>

                    {/* Progress to next tier */}
                    {nextTier && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-white/30">
                            {mmrInteger.toLocaleString()} / {nextTier.minMMR.toLocaleString()}
                          </span>
                          <span style={{ color: `${nextTierHex}80` }}>{nextTier.name}</span>
                        </div>
                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <motion.div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${tierHex}, ${nextTierHex})`,
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${tierProgress * 100}%` }}
                            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                          />
                          {/* Glow on tip */}
                          <motion.div
                            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full blur-sm"
                            style={{ backgroundColor: nextTierHex }}
                            initial={{ left: 0, opacity: 0 }}
                            animate={{ left: `${tierProgress * 100}%`, opacity: 0.6 }}
                            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    )}
                    {!nextTier && playerTier?.name === "Elite" && (
                      <p className="text-[11px] text-white/25 italic">Peak rank achieved</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-lg text-white/40">No MMR yet</span>
                    <p className="text-xs text-white/25">
                      {isOwnProfile ? "Play a Blitz round to earn your rank" : "This player has no MMR yet"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isTrimmed && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleCopyProfilePng}
              variant="gold"
              className="w-full flex-1 justify-center gap-2 !px-4 !py-2.5"
              forceUppercase={false}
              isLoading={isCopyingProfileCard}
              disabled={isCopyingProfileCard}
            >
              <Copy className="h-4 w-4" />
              <span>{isCopyingProfileCard ? "Preparing image..." : "Copy PNG"}</span>
            </Button>
            <Button
              onClick={handleShareProfileOnX}
              variant="outline"
              className="w-full flex-1 justify-center gap-2 !px-4 !py-2.5"
              forceUppercase={false}
            >
              <Share2 className="h-4 w-4" />
              <span>Share on X</span>
            </Button>
          </div>
        )}
      </div>

      {/* ═══ AVATAR CUSTOMIZATION (collapsible) ═══ */}
      {!isTrimmed ? (
        isOwnProfile ? (
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            {/* Collapsed preview / toggle */}
            <button
              type="button"
              onClick={() => setShowAvatarSection((prev) => !prev)}
              aria-expanded={showAvatarSection}
              className="w-full flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-white/[0.02]"
            >
              <div className="h-8 w-8 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                <img className="h-full w-full object-cover" src={currentAvatarUrl} alt="" />
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm text-white/60">Customize Avatar</span>
              </div>
              <motion.div animate={{ rotate: showAvatarSection ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="w-4 h-4 text-white/30" />
              </motion.div>
            </button>

            {/* Expandable section */}
            <AnimatePresence initial={false}>
              {showAvatarSection && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-2 space-y-4 border-t border-white/[0.04]">
                    <div className="flex flex-col sm:flex-row gap-5 items-start">
                      {/* Avatar Preview */}
                      <div className="flex-shrink-0 mx-auto sm:mx-0">
                        <div className="w-32 h-32 rounded-xl overflow-hidden border border-white/10 bg-brown/30">
                          {isLoadingAvatarOrAccount ? (
                            <div className="h-full w-full flex items-center justify-center bg-white/[0.03]">
                              <Loader2 className="w-6 h-6 animate-spin text-gold/50" />
                            </div>
                          ) : (
                            <img className="h-full w-full object-cover" src={currentAvatarUrl} alt={profileAvatarAlt} />
                          )}
                        </div>
                        {myAvatar && myAvatar.generationCount !== undefined && (
                          <p className="text-[11px] text-white/30 text-center mt-2">
                            {myAvatar.generationCount}/{dailyGenerationLimit} daily
                          </p>
                        )}
                        {hasReachedDailyLimit && (
                          <p className="text-[10px] text-amber-300/50 text-center mt-1">
                            Limit reached{resetCountdownLabel ? ` · ${resetCountdownLabel}` : ""}
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
                                <label className="text-xs text-white/40 block mb-1.5">
                                  Describe your avatar (e.g., "cyberpunk warrior")
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
                                <div className="text-xs text-red-400/80 bg-red-900/10 border border-red-700/20 rounded-lg px-2.5 py-1.5">
                                  {getErrorMessage(generateAvatar.error, "Failed to generate avatar")}
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
                                    generateAvatar.isPending ||
                                    !avatarPrompt.trim() ||
                                    !hasOwnDisplayName ||
                                    hasReachedDailyLimit
                                  }
                                >
                                  <Sparkles className="w-4 h-4" />
                                  <span>
                                    {generateAvatar.isPending
                                      ? "Generating..."
                                      : hasCustomAvatar
                                        ? "Regenerate"
                                        : "Generate"}
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
                                  <p className="text-xs text-white/30">Latest generation</p>
                                  <AvatarImageGrid
                                    images={latestGeneratedImages}
                                    selectedUrl={myAvatar?.avatarUrl}
                                    onSelect={handleSelectAvatar}
                                    isSelecting={selectAvatar.isPending}
                                  />
                                </div>
                              ) : (
                                <p className="text-xs text-white/30">Generate an avatar to see your options.</p>
                              )}

                              {!hasOwnDisplayName && (
                                <p className="text-xs text-yellow-400/60">
                                  Connect with Cartridge to create a custom avatar
                                </p>
                              )}
                            </Tabs.Panel>

                            <Tabs.Panel className="space-y-3">
                              {isGalleryLoading ? (
                                <div className="flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] py-6">
                                  <Loader2 className="w-5 h-5 animate-spin text-gold/40" />
                                </div>
                              ) : galleryItems && galleryItems.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                  {galleryItems.map((item, index) => {
                                    const isOwnImage = Boolean(
                                      item.cartridgeUsername && item.cartridgeUsername === ownDisplayName,
                                    );
                                    const isSelected = myAvatar?.avatarUrl === item.imageUrl;
                                    const canSelect = canSelectFromGallery && isOwnImage;

                                    return (
                                      <div key={`${item.imageUrl}-${index}`} className="space-y-1">
                                        <button
                                          type="button"
                                          className={`group relative w-full overflow-hidden rounded-lg border bg-black/20 transition ${
                                            isSelected ? "border-gold/50" : "border-white/[0.06] hover:border-white/15"
                                          } ${!canSelect || isSelected ? "cursor-default" : ""}`}
                                          onClick={() => {
                                            if (!canSelect || isSelected) return;
                                            void handleSelectAvatar(item.imageUrl);
                                          }}
                                          disabled={!canSelect || isSelected || selectAvatar.isPending}
                                          aria-pressed={isSelected}
                                        >
                                          <img
                                            className="h-24 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                            src={item.imageUrl}
                                            alt={item.prompt}
                                          />
                                          {canSelect && (
                                            <div
                                              className={`absolute inset-0 flex items-end justify-center pb-2 text-[11px] font-semibold uppercase tracking-wide transition-all duration-150 ${
                                                isSelected
                                                  ? "bg-black/50 text-gold"
                                                  : "bg-black/0 text-transparent group-hover:bg-black/40 group-hover:text-gold"
                                              }`}
                                            >
                                              {isSelected ? "Active" : "Use"}
                                            </div>
                                          )}
                                        </button>
                                        <p className="text-[11px] text-white/30 truncate">{item.prompt}</p>
                                        {item.cartridgeUsername && (
                                          <p className="text-[10px] text-white/20">@{item.cartridgeUsername}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-white/30">No creations yet. Be the first to generate.</p>
                              )}
                            </Tabs.Panel>
                          </Tabs.Panels>
                        </Tabs>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-black/30 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                <img className="h-full w-full object-cover" src={currentAvatarUrl} alt={profileAvatarAlt} />
              </div>
              <div>
                <div className="text-sm text-white/70">Viewing {displayName}</div>
                <div className="text-xs text-white/40">Avatar customization is only available on your own profile.</div>
              </div>
            </div>
          </div>
        )
      ) : null}
    </section>
  );
};
