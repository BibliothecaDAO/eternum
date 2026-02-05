import { cn } from "@/ui/design-system/atoms/lib/utils";

interface HeroTitleProps {
  title?: string;
  tagline?: string;
  className?: string;
}

/**
 * Large stylized ETERNUM title with optional tagline.
 * Uses Cinzel font for fantasy aesthetic.
 */
export const HeroTitle = ({
  title = "ETERNUM",
  tagline = "Forge your destiny in a world of eternal conflict",
  className,
}: HeroTitleProps) => {
  return (
    <div className={cn("flex flex-col items-start gap-6", className)}>
      {/* Main title with letter spacing for dramatic effect */}
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
