import { cn } from "@/ui/design-system/atoms/lib/utils";
import { MarketsProviders } from "@/ui/features/landing/sections/markets";
import { Clock, History, TrendingUp } from "lucide-react";
import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";

// Lazy load the markets component
const LandingMarkets = lazy(() =>
  import("@/ui/features/landing/sections/markets").then((m) => ({ default: m.LandingMarkets })),
);

interface MarketsViewProps {
  className?: string;
}

type MarketsTab = "live" | "past";

/**
 * Reusable loading spinner
 */
const LoadingSpinner = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
  </div>
);

/**
 * Panel wrapper component with consistent styling
 */
interface MarketPanelProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: "emerald" | "amber";
  children: React.ReactNode;
  className?: string;
}

const MarketPanel = ({ title, subtitle, icon, accentColor, children, className }: MarketPanelProps) => {
  const accentStyles = {
    emerald: {
      border: "border-emerald-500/30 hover:border-emerald-500/50",
      glow: "shadow-[0_0_30px_rgba(16,185,129,0.1)]",
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-400",
      titleColor: "text-emerald-400",
      dot: "bg-emerald-400",
      dotGlow: "shadow-[0_0_10px_rgba(16,185,129,0.8)]",
    },
    amber: {
      border: "border-amber-500/30 hover:border-amber-500/50",
      glow: "shadow-[0_0_30px_rgba(245,158,11,0.1)]",
      iconBg: "bg-amber-500/20",
      iconColor: "text-amber-400",
      titleColor: "text-amber-400",
      dot: "bg-amber-400",
      dotGlow: "shadow-[0_0_10px_rgba(245,158,11,0.8)]",
    },
  };

  const styles = accentStyles[accentColor];

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border bg-black/60 backdrop-blur-xl transition-all duration-300",
        styles.border,
        styles.glow,
        className,
      )}
    >
      {/* Panel Header */}
      <div className="flex items-center gap-4 border-b border-gold/10 p-4 md:p-6">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", styles.iconBg)}>{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className={cn("font-serif text-xl font-semibold md:text-2xl", styles.titleColor)}>{title}</h2>
            {accentColor === "emerald" && (
              <span className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 animate-pulse rounded-full", styles.dot, styles.dotGlow)} />
                <span className="text-xs font-medium text-emerald-400/80">LIVE</span>
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gold/60">{subtitle}</p>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
    </div>
  );
};

/**
 * Active markets content - shows live prediction markets
 */
const ActiveMarketsContent = () => (
  <MarketsProviders>
    <Suspense fallback={<LoadingSpinner />}>
      <LandingMarkets />
    </Suspense>
  </MarketsProviders>
);

/**
 * Past markets content - shows historical market data
 */
const PastMarketsContent = () => (
  <div className="space-y-4">
    <p className="text-sm text-gold/70">View historical market activity and completed trades.</p>
    {/* Past market entries */}
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="group flex items-center justify-between rounded-xl border border-gold/10 bg-black/40 p-4 transition-all duration-200 hover:border-gold/20 hover:bg-black/50"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 transition-transform duration-200 group-hover:scale-105">
            <span className="text-sm font-semibold text-amber-400">#{i}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gold transition-colors group-hover:text-gold/90">
              Game Session #{1000 - i}
            </h3>
            <p className="text-xs text-gold/50">
              Ended {i + 1} days ago - {20 + i * 5} trades
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gold">{(10000 + i * 2450).toLocaleString()} $LORDS</p>
          <p className="text-xs text-gold/50">Total Volume</p>
        </div>
      </div>
    ))}
  </div>
);

/**
 * Mobile tab button
 */
interface TabButtonProps {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  accentColor: "emerald" | "amber";
}

const TabButton = ({ isActive, onClick, icon, label, accentColor }: TabButtonProps) => {
  const activeStyles = {
    emerald: "bg-emerald-500/20 border-emerald-500/50 text-emerald-400",
    amber: "bg-amber-500/20 border-amber-500/50 text-amber-400",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-all duration-200",
        isActive ? activeStyles[accentColor] : "border-gold/20 bg-black/40 text-gold/60 hover:bg-black/50",
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

/**
 * Markets view wrapper for the new landing layout.
 * Features split panels for Active and Past markets.
 * Responsive: stacked with tabs on mobile, side-by-side on desktop.
 */
export const MarketsView = ({ className }: MarketsViewProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as MarketsTab) || "live";

  const handleTabChange = (tab: MarketsTab) => {
    if (tab === "live") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", tab);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Mobile Tab Navigation - visible only on smaller screens */}
      <div className="flex gap-3 lg:hidden">
        <TabButton
          isActive={activeTab === "live"}
          onClick={() => handleTabChange("live")}
          icon={<TrendingUp className="h-4 w-4" />}
          label="Active Markets"
          accentColor="emerald"
        />
        <TabButton
          isActive={activeTab === "past"}
          onClick={() => handleTabChange("past")}
          icon={<History className="h-4 w-4" />}
          label="Past Markets"
          accentColor="amber"
        />
      </div>

      {/* Split Panel Layout */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Active Markets Panel */}
        <div className={cn("lg:flex-1", activeTab !== "live" && "hidden lg:flex")}>
          <MarketPanel
            title="Active Markets"
            subtitle="Browse and participate in live prediction markets"
            icon={<TrendingUp className="h-6 w-6 text-emerald-400" />}
            accentColor="emerald"
            className="h-full min-h-[400px] lg:min-h-[600px]"
          >
            <ActiveMarketsContent />
          </MarketPanel>
        </div>

        {/* Past Markets Panel */}
        <div className={cn("lg:w-[400px] lg:flex-shrink-0", activeTab !== "past" && "hidden lg:flex")}>
          <MarketPanel
            title="Past Markets"
            subtitle="Historical market activity and results"
            icon={<Clock className="h-6 w-6 text-amber-400" />}
            accentColor="amber"
            className="h-full min-h-[400px] lg:min-h-[600px]"
          >
            <PastMarketsContent />
          </MarketPanel>
        </div>
      </div>
    </div>
  );
};
