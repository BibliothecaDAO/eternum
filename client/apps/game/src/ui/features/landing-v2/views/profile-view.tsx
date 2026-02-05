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

const WalletSection = lazy(() => import("../components/wallet-section").then((m) => ({ default: m.WalletSection })));

interface ProfileViewProps {
  className?: string;
}

type ProfileTab = "profile" | "cosmetics" | "wallet";

const LoadingSpinner = () => (
  <div className="flex h-full min-h-[400px] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
  </div>
);

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
          <Suspense fallback={<LoadingSpinner />}>
            <div className="h-full">
              <LandingCosmetics />
            </div>
          </Suspense>
        );
      case "wallet":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <WalletSection />
          </Suspense>
        );
      case "profile":
      default:
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <LandingPlayer />
          </Suspense>
        );
    }
  };

  return (
    <div
      className={cn(
        "h-[85vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/5 via-black/40 to-black/90 p-8 shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl",
        className,
      )}
    >
      {renderContent()}
    </div>
  );
};
