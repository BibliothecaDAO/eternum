import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Lazy load heavy components
const LandingPlayer = lazy(() =>
  import("@/ui/features/landing/sections/player").then((m) => ({ default: m.LandingPlayer })),
);

const LandingCosmetics = lazy(() =>
  import("@/ui/features/landing/sections/cosmetics").then((m) => ({ default: m.LandingCosmetics })),
);

// Wallet view placeholder - can be expanded later
const WalletView = () => (
  <div className="rounded-2xl border border-gold/20 bg-black/60 p-6 backdrop-blur-xl">
    <h3 className="mb-4 font-serif text-lg text-gold">Wallet</h3>
    <p className="text-sm text-gold/70">Wallet management and transaction history coming soon...</p>
  </div>
);

interface ProfileViewProps {
  className?: string;
}

type ProfileTab = "stats" | "cosmetics" | "wallet";

const TAB_CONFIG: { id: ProfileTab; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "cosmetics", label: "Cosmetics" },
  { id: "wallet", label: "Wallet" },
];

/**
 * Profile view with sub-tabs for Stats, Cosmetics, and Wallet.
 * Wraps existing landing components in the new layout.
 */
export const ProfileView = ({ className }: ProfileViewProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as ProfileTab) || "stats";
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  const handleTabChange = (index: number) => {
    const tab = TAB_CONFIG[index].id;
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const activeIndex = TAB_CONFIG.findIndex((t) => t.id === activeTab);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Profile header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-gold sm:text-3xl">Profile</h1>
      </div>

      {/* Sub-tabs */}
      <Tabs
        variant="primary"
        selectedIndex={activeIndex >= 0 ? activeIndex : 0}
        onChange={handleTabChange}
        className="w-full"
      >
        <Tabs.List className="mb-6 flex gap-2">
          {TAB_CONFIG.map((tab) => (
            <Tabs.Tab key={tab.id} className="px-4 py-2">
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panels>
          {/* Stats Tab */}
          <Tabs.Panel>
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                </div>
              }
            >
              <LandingPlayer />
            </Suspense>
          </Tabs.Panel>

          {/* Cosmetics Tab */}
          <Tabs.Panel>
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                </div>
              }
            >
              <LandingCosmetics />
            </Suspense>
          </Tabs.Panel>

          {/* Wallet Tab */}
          <Tabs.Panel>
            <WalletView />
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </div>
  );
};
