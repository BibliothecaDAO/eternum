import { cn } from "@/ui/design-system/atoms/lib/utils";

interface HeroTitleProps {
  className?: string;
}

/**
 * Blitz logo with tagline - centered hero banner.
 */
export const HeroTitle = ({ className }: HeroTitleProps) => {
  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      <img
        src="/assets/icons/blitz-words-logo-g.svg"
        alt="Realms World Blitz"
        className={cn(
          "h-auto w-[280px] sm:w-[320px] md:w-[380px]",
          "drop-shadow-[0_0_30px_rgba(223,170,84,0.3)]",
          "select-none",
          "animate-[fadeIn_1s_ease-out]",
        )}
      />

      {/* Decorative line */}
      <div className="flex items-center gap-4 w-full max-w-sm">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        <div className="h-2 w-2 rotate-45 border border-gold/50" />
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      </div>

      {/* Tagline */}
      <p
        className={cn(
          "text-lg text-gold/70 sm:text-xl text-center",
          "font-light tracking-wide",
          "animate-[fadeIn_1s_ease-out_0.3s_both]",
        )}
      >
        Forge your destiny
      </p>
    </div>
  );
};
