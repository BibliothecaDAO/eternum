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
        return (
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            }
          >
            <WalletSection />
          </Suspense>
        );
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
