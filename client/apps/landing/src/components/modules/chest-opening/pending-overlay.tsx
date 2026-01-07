import { useRef, useEffect, useCallback, useState } from "react";
import gsap from "gsap";
import { Copy, Check, AlertCircle, RotateCcw, X } from "lucide-react";
import { ChestStageContainer, ChestStageContent } from "./chest-stage-container";
import { RARITY_STYLES, AssetRarity } from "@/utils/cosmetics";
import { Button } from "@/components/ui/button";

interface PendingOverlayProps {
  /** Whether the overlay should be visible */
  active: boolean;
  /** Main title text */
  title?: string;
  /** Subtitle/status text */
  subtitle?: string;
  /** Transaction hash (if available) */
  txHash?: string;
  /** Chest rarity for styling */
  rarity?: AssetRarity;
  /** Error state */
  error?: Error | null;
  /** Called when user wants to close (may be blocked during pending) */
  onClose?: () => void;
  /** Called when user wants to retry after error */
  onRetry?: () => void;
}

/**
 * PendingOverlay - Premium loading state for chest opening.
 *
 * Shown during blockchain transaction confirmation.
 * Features:
 * - GSAP entrance/exit animations
 * - Subtle pulsing glow effect
 * - Animated loading dots
 * - Optional tx hash with copy
 * - Rarity-based styling
 */
export function PendingOverlay({
  active,
  title = "Opening chest",
  subtitle = "Waiting for confirmation",
  txHash,
  rarity = AssetRarity.Common,
  error,
  onClose,
  onRetry,
}: PendingOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const pulseTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const [copied, setCopied] = useState(false);

  const rarityStyle = RARITY_STYLES[rarity];

  // Copy tx hash to clipboard
  const handleCopyTxHash = useCallback(async () => {
    if (!txHash) return;
    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [txHash]);

  // Main entrance/exit animation
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Kill any existing timeline
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
    }

    if (active) {
      // Set initial state
      gsap.set(container, { opacity: 0, scale: 0.95 });

      // Create entrance timeline
      const tl = gsap.timeline();
      timelineRef.current = tl;

      tl.to(container, {
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: "power2.out",
      });
    }

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
    };
  }, [active]);

  // Continuous pulse animation for the glow
  useEffect(() => {
    if (!glowRef.current || !active) return;

    const glow = glowRef.current;

    // Kill any existing pulse timeline
    if (pulseTimelineRef.current) {
      pulseTimelineRef.current.kill();
      pulseTimelineRef.current = null;
    }

    // Create looping pulse animation
    const pulseTl = gsap.timeline({ repeat: -1, yoyo: true });
    pulseTimelineRef.current = pulseTl;

    pulseTl.to(glow, {
      opacity: 0.6,
      scale: 1.1,
      duration: 1.5,
      ease: "sine.inOut",
    });

    return () => {
      if (pulseTimelineRef.current) {
        pulseTimelineRef.current.kill();
        pulseTimelineRef.current = null;
      }
    };
  }, [active]);

  if (!active) return null;

  // Truncate tx hash for display
  const truncatedHash = txHash
    ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
    : null;

  return (
    <ChestStageContainer>
      <ChestStageContent>
        <div
          ref={containerRef}
          className="relative flex flex-col items-center justify-center text-center max-w-md mx-auto"
        >
          {/* Animated glow background */}
          <div
            ref={glowRef}
            className={`absolute inset-0 -m-8 rounded-full blur-3xl opacity-30 ${rarityStyle.bg}`}
            style={{ willChange: "transform, opacity" }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Rarity badge */}
            {rarity && (
              <div
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${rarityStyle.bg} text-white`}
              >
                {rarity}
              </div>
            )}

            {/* Chest icon with animation */}
            <div className="relative">
              {/* Animated rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`w-24 h-24 rounded-full border-2 ${rarityStyle.border} animate-ping opacity-20`}
                  style={{ animationDuration: "2s" }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`w-20 h-20 rounded-full border ${rarityStyle.border} animate-ping opacity-30`}
                  style={{ animationDuration: "2s", animationDelay: "0.5s" }}
                />
              </div>

              {/* Center spinner */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div
                  className={`w-16 h-16 rounded-full border-4 border-t-transparent ${rarityStyle.border} animate-spin`}
                  style={{ animationDuration: "1.2s" }}
                />
                {/* Inner glow */}
                <div
                  className={`absolute w-8 h-8 rounded-full ${rarityStyle.bg} opacity-50 blur-sm`}
                />
              </div>
            </div>

            {/* Title with animated dots */}
            {error ? (
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <h2 className="text-xl font-bold text-red-500">
                  Failed to Open
                </h2>
                <p className="text-sm text-white/60 max-w-xs">
                  {error.message || "Something went wrong. Please try again."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <h2 className="text-2xl font-bold text-gold flex items-center gap-1">
                  {title}
                  <LoadingDots />
                </h2>
                <p className="text-sm text-white/60">{subtitle}</p>
              </div>
            )}

            {/* Transaction hash */}
            {txHash && !error && (
              <button
                onClick={handleCopyTxHash}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors text-xs text-white/50 hover:text-white/70"
              >
                <span className="font-mono">{truncatedHash}</span>
                {copied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}

            {/* Action buttons for error state */}
            {error && (
              <div className="flex gap-3 mt-2">
                {onClose && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Close
                  </Button>
                )}
                {onRetry && (
                  <Button
                    variant="cta"
                    size="sm"
                    onClick={onRetry}
                    className="gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Try Again
                  </Button>
                )}
              </div>
            )}

            {/* Safety message */}
            {!error && (
              <p className="text-xs text-white/40 mt-4 max-w-xs">
                Please don&apos;t close this window while the transaction is
                being confirmed.
              </p>
            )}
          </div>
        </div>
      </ChestStageContent>
    </ChestStageContainer>
  );
}

/**
 * Animated loading dots component
 */
function LoadingDots() {
  return (
    <span className="inline-flex ml-1">
      <span
        className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce"
        style={{ animationDelay: "0ms", animationDuration: "1s" }}
      />
      <span
        className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce ml-0.5"
        style={{ animationDelay: "150ms", animationDuration: "1s" }}
      />
      <span
        className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce ml-0.5"
        style={{ animationDelay: "300ms", animationDuration: "1s" }}
      />
    </span>
  );
}
