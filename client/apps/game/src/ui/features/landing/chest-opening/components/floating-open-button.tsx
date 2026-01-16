import Button from "@/ui/design-system/atoms/button";
import { Package } from "lucide-react";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CHEST_OPENING_ENABLED } from "./index";

interface FloatingOpenButtonProps {
  chestCount: number;
  onClick: () => void;
  disabled?: boolean;
}

export function FloatingOpenButton({ chestCount, onClick, disabled = false }: FloatingOpenButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Pulse animation for the glow effect
  useEffect(() => {
    if (!CHEST_OPENING_ENABLED) return;
    if (!glowRef.current || disabled || chestCount === 0) return;

    const ctx = gsap.context(() => {
      gsap.to(glowRef.current, {
        scale: 1.2,
        opacity: 0.3,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });

    return () => ctx.revert();
  }, [disabled, chestCount]);

  // Subtle float animation
  useEffect(() => {
    if (!CHEST_OPENING_ENABLED) return;
    if (!buttonRef.current || disabled || chestCount === 0) return;

    const ctx = gsap.context(() => {
      gsap.to(buttonRef.current, {
        y: -4,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    });

    return () => ctx.revert();
  }, [disabled, chestCount]);

  // Return null if feature is disabled or no chests
  if (!CHEST_OPENING_ENABLED || chestCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-6 z-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Glow effect */}
      <div ref={glowRef} className="absolute inset-0 bg-gold/20 rounded-full blur-xl pointer-events-none" />

      {/* Main button */}
      <Button
        ref={buttonRef}
        variant="primary"
        size="md"
        onClick={onClick}
        disabled={disabled}
        className="relative shadow-lg hover:shadow-xl transition-shadow duration-200 px-6 py-3 gap-2"
      >
        <Package className="w-5 h-5" />
        <span>Open Chest</span>

        {/* Count badge */}
        {chestCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-gold text-background text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md">
            {chestCount > 99 ? "99+" : chestCount}
          </span>
        )}
      </Button>
    </div>
  );
}
