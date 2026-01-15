import { Button } from "@/components/ui/button";
import gsap from "gsap";
import { AlertCircle, Check, Copy, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChestStageContainer, ChestStageContent } from "./chest-stage-container";

interface PendingOverlayProps {
  /** Whether the overlay should be visible */
  active: boolean;
  /** Main title text */
  title?: string;
  /** Subtitle/status text */
  subtitle?: string;
  /** Transaction hash (if available) */
  txHash?: string;
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
  error,
  onClose,
  onRetry,
}: PendingOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const pulseTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const [copied, setCopied] = useState(false);

  // Use gold/neutral styling for pending state (rarity unknown until reveal)
  const pendingStyle = {
    bg: "bg-gold",
    border: "border-gold",
    text: "text-gold",
  };

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
  const truncatedHash = txHash ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}` : null;

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
            className={`absolute inset-0 -m-8 rounded-full blur-3xl opacity-30 ${pendingStyle.bg}`}
            style={{ willChange: "transform, opacity" }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center gap-6">
            {/* Eternum loader */}
            <img src="/images/logos/eternum-loader.png" alt="Loading" className="w-14 animate-pulse" />

            {/* Title with animated dots */}
            {error ? (
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <h2 className="text-xl font-bold text-red-500">Failed to Open</h2>
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
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
            )}

            {/* Action buttons for error state */}
            {error && (
              <div className="flex gap-3 mt-2">
                {onClose && (
                  <Button variant="outline" size="sm" onClick={onClose} className="gap-2">
                    <X className="w-4 h-4" />
                    Close
                  </Button>
                )}
                {onRetry && (
                  <Button variant="cta" size="sm" onClick={onRetry} className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Try Again
                  </Button>
                )}
              </div>
            )}

            {/* Safety message */}
            {!error && (
              <p className="text-xs text-white/40 mt-4 max-w-xs">
                Please don&apos;t close this window while the transaction is being confirmed.
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
