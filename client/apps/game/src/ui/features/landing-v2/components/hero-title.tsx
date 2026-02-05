import { cn } from "@/ui/design-system/atoms/lib/utils";

interface HeroTitleProps {
  className?: string;
}

/**
 * Blitz logo - centered hero banner.
 */
export const HeroTitle = ({ className }: HeroTitleProps) => {
  return (
    <div className={cn("flex flex-col items-center", className)}>
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
    </div>
  );
};
