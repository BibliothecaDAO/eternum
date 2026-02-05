import { cn } from "@/ui/design-system/atoms/lib/utils";

interface HeroTitleProps {
  tagline?: string;
  className?: string;
}

/**
 * Realms World logo with BLITZ subtitle and tagline.
 */
export const HeroTitle = ({
  tagline = "Forge your destiny in a world of relentless battles",
  className,
}: HeroTitleProps) => {
  return (
    <div className={cn("flex flex-col items-start gap-6", className)}>
      {/* Realms Logo */}
      <div className="flex flex-col gap-2">
        <img
          src="/images/logos/realms-world-white.svg"
          alt="Realms World"
          className={cn(
            "h-auto w-[280px] sm:w-[320px] md:w-[380px] lg:w-[420px]",
            "drop-shadow-[0_0_30px_rgba(223,170,84,0.3)]",
            "select-none",
            "animate-[fadeIn_1s_ease-out]",
          )}
        />
        <span
          className={cn(
            "font-serif text-2xl font-semibold tracking-[0.3em] text-gold/80 sm:text-3xl md:text-4xl",
            "drop-shadow-[0_0_20px_rgba(223,170,84,0.2)]",
            "select-none",
            "animate-[fadeIn_1s_ease-out_0.15s_both]",
          )}
        >
          BLITZ
        </span>
      </div>

      {/* Decorative line */}
      <div className="flex items-center gap-4 w-full max-w-md">
        <div className="h-px flex-1 bg-gradient-to-r from-gold/50 to-transparent" />
        <div className="h-2 w-2 rotate-45 border border-gold/50" />
        <div className="h-px flex-1 bg-gradient-to-l from-gold/50 to-transparent" />
      </div>

      {/* Tagline */}
      {tagline && (
        <p
          className={cn(
            "max-w-md text-base text-gold/70 sm:text-lg md:text-xl",
            "font-light tracking-wide leading-relaxed",
            "animate-[fadeIn_1s_ease-out_0.3s_both]",
          )}
        >
          {tagline}
        </p>
      )}
    </div>
  );
};
