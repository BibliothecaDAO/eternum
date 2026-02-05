import { cn } from "@/ui/design-system/atoms/lib/utils";
import { MarketsProviders } from "@/ui/features/landing/sections/markets";
import { lazy, Suspense } from "react";

// Lazy load the markets component
const LandingMarkets = lazy(() =>
  import("@/ui/features/landing/sections/markets").then((m) => ({ default: m.LandingMarkets })),
);

interface MarketsViewProps {
  className?: string;
}

/**
 * Markets view wrapper for the new landing layout.
 * Lazy loads the existing markets component with required providers.
 */
export const MarketsView = ({ className }: MarketsViewProps) => {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Markets header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-gold sm:text-3xl">Markets</h1>
      </div>

      {/* Markets content with required providers */}
      <MarketsProviders>
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            </div>
          }
        >
          <LandingMarkets />
        </Suspense>
      </MarketsProviders>
    </div>
  );
};
