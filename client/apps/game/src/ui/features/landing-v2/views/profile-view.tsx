import { cn } from "@/ui/design-system/atoms/lib/utils";
import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";

// Lazy load heavy components
const LandingPlayer = lazy(() =>
  import("@/ui/features/landing/sections/player").then((m) => ({ default: m.LandingPlayer })),
);

const LandingCosmetics = lazy(() =>
  import("@/ui/features/landing/sections/cosmetics").then((m) => ({ default: m.LandingCosmetics })),
);

// Wallet view placeholder - can be expanded later
const WalletContent = () => (
  <div className="rounded-2xl border border-gold/20 bg-black/60 p-6 backdrop-blur-xl">
    <h3 className="mb-4 font-serif text-lg text-gold">Wallet</h3>
    <p className="text-sm text-gold/70 mb-6">Manage your assets and view transaction history.</p>
    <div className="space-y-4">
      {/* Placeholder wallet info */}
      <div className="rounded-lg border border-gold/10 bg-black/40 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gold/60 text-sm">$LORDS Balance</span>
          <span className="text-gold font-semibold">0.00</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gold/60 text-sm">ETH Balance</span>
          <span className="text-gold font-semibold">0.00</span>
        </div>
      </div>
      <button className="w-full px-4 py-3 rounded-lg border border-gold/30 text-gold/70 hover:text-gold hover:border-gold/50 transition-colors">
        View Full Wallet
      </button>
    </div>
  </div>
);

interface ProfileViewProps {
  className?: string;
}

type ProfileTab = "profile" | "cosmetics" | "wallet";

/**
 * Profile view with sub-tabs for Profile (Stats), Cosmetics, and Wallet.
 * Tab navigation is handled by the header - this view just renders the content.
 */
export const ProfileView = ({ className }: ProfileViewProps) => {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as ProfileTab) || "profile";

  const renderContent = () => {
    switch (activeTab) {
      case "cosmetics":
        return (
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            }
          >
            <LandingCosmetics />
          </Suspense>
        );
      case "wallet":
        return <WalletContent />;
      case "profile":
      default:
        return (
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            }
          >
            <LandingPlayer />
          </Suspense>
        );
    }
  };

  return <div className={cn("flex flex-col gap-6", className)}>{renderContent()}</div>;
};
