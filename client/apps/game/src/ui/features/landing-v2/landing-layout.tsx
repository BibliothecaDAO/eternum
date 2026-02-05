import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Controller } from "@/ui/modules/controller/controller";
import { BlankOverlayContainer } from "@/ui/shared/containers/blank-overlay-container";
import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { DynamicBackground } from "./components/background/dynamic-background";
import { LandingHeader } from "./components/landing-header";
import { LandingSettings } from "./components/landing-settings";
import { LandingSidebar } from "./components/landing-sidebar";
import { MobileBottomNav } from "./components/mobile-bottom-nav";
import { LandingProvider, useLandingContext } from "./context/landing-context";

// Route to background mapping
const ROUTE_BACKGROUNDS: Record<string, string> = {
  "/": "01",
  "/profile": "05",
  "/markets": "04",
  "/leaderboard": "07",
};

/**
 * Main layout wrapper for the new unified landing page.
 * Features:
 * - Full-bleed dynamic background with crossfade transitions
 * - Icon-only sidebar on desktop
 * - Bottom tab bar on mobile
 * - Minimal top header with navigation
 */
export const LandingLayoutV2 = () => {
  const location = useLocation();

  // Get default background for current route
  const routeBackground = ROUTE_BACKGROUNDS[location.pathname] ?? "01";

  return (
    <LandingProvider defaultBackground={routeBackground}>
      <LandingLayoutContent />
    </LandingProvider>
  );
};

/**
 * Inner layout content that can access the landing context.
 */
const LandingLayoutContent = () => {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { backgroundId, resetBackground } = useLandingContext();

  // Reset background when route changes
  useEffect(() => {
    resetBackground();
  }, [location.pathname, resetBackground]);

  const handleSettingsClick = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-gold">
      {/* Dynamic background */}
      <DynamicBackground backgroundId={backgroundId} />

      {/* Left sidebar (desktop only) */}
      <LandingSidebar onSettingsClick={handleSettingsClick} />

      {/* Top header with wallet controller */}
      <LandingHeader walletButton={<Controller />} />

      {/* Main content area */}
      <main
        className={cn(
          "relative z-10 min-h-screen",
          // Padding for header and sidebar/bottom nav
          "pt-20 pb-24 lg:pb-8 lg:pl-16",
          "flex flex-col",
        )}
      >
        {/* Modal host for landing routes */}
        <LandingModalHost />

        {/* Page content */}
        <div className="flex-1 px-6 lg:px-10">
          <Outlet />
        </div>
      </main>

      {/* Bottom navigation (mobile only) */}
      <MobileBottomNav onSettingsClick={handleSettingsClick} />

      {/* Settings modal */}
      {settingsOpen && (
        <BlankOverlayContainer
          zIndex={100}
          open={settingsOpen}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) handleSettingsClose();
          }}
        >
          <LandingSettings onClose={handleSettingsClose} />
        </BlankOverlayContainer>
      )}
    </div>
  );
};

/**
 * Modal host component for landing-specific modals.
 */
const LandingModalHost = () => {
  const showModal = useUIStore((state) => state.showModal);
  const modalContent = useUIStore((state) => state.modalContent);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const onOverlayDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) toggleModal(null);
    },
    [toggleModal],
  );

  useEffect(() => {
    if (!showModal) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        ev.preventDefault();
        toggleModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal, toggleModal]);

  return (
    <BlankOverlayContainer zIndex={120} open={showModal} onPointerDown={onOverlayDown}>
      {modalContent}
    </BlankOverlayContainer>
  );
};
