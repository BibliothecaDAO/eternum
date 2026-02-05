import { cn } from "@/ui/design-system/atoms/lib/utils";

interface HeroTitleProps {
  title?: string;
  subtitle?: string;
  tagline?: string;
  className?: string;
}

/**
 * Large stylized REALMS: BLITZ title with optional tagline.
 * Uses Cinzel font for fantasy aesthetic.
 */
export const HeroTitle = ({
  title = "REALMS",
  subtitle = "BLITZ",
  tagline = "Forge your destiny in a world of relentless battles",
  className,
}: HeroTitleProps) => {
  return (
    <div className={cn("flex flex-col items-start gap-6", className)}>
      {/* Main title with letter spacing for dramatic effect */}
      <div className="flex flex-col gap-1">
        <h1
          className={cn(
            "font-serif text-5xl font-bold tracking-[0.15em] text-gold sm:text-6xl md:text-7xl lg:text-8xl",
            // Glow effect
            "drop-shadow-[0_0_30px_rgba(223,170,84,0.3)]",
            // Text shadow for depth
            "[text-shadow:_0_4px_20px_rgba(223,170,84,0.2)]",
            "select-none",
            // Subtle animation
            "animate-[fadeIn_1s_ease-out]",
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <span
            className={cn(
              "font-serif text-2xl font-semibold tracking-[0.3em] text-gold/80 sm:text-3xl md:text-4xl lg:text-5xl",
              "drop-shadow-[0_0_20px_rgba(223,170,84,0.2)]",
              "select-none",
              "animate-[fadeIn_1s_ease-out_0.15s_both]",
            )}
          >
            {subtitle}
          </span>
        )}
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
