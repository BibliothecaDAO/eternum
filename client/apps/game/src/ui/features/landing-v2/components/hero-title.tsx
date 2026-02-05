import { cn } from "@/ui/design-system/atoms/lib/utils";

interface HeroTitleProps {
  tagline?: string;
  className?: string;
}

/**
 * Blitz logo with tagline.
 */
export const HeroTitle = ({ tagline = "Forge your destiny", className }: HeroTitleProps) => {
  return (
    <div className={cn("flex flex-col items-start gap-6", className)}>
      {/* Blitz Logo */}
      <img
        src="/assets/icons/blitz-words-logo-g.svg"
        alt="Realms World Blitz"
        className={cn(
          "h-auto w-[280px] sm:w-[320px] md:w-[380px] lg:w-[420px]",
          "drop-shadow-[0_0_30px_rgba(223,170,84,0.3)]",
          "select-none",
          "animate-[fadeIn_1s_ease-out]",
        )}
      />

      {/* Decorative line */}
      <div className="flex items-center gap-4 w-full max-w-md">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        <div className="h-2 w-2 rotate-45 border border-gold/50" />
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      </div>

      {/* Tagline */}
      {tagline && (
        <p
          className={cn(
            "text-base text-gold/70 sm:text-lg md:text-xl text-center w-full max-w-md",
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
