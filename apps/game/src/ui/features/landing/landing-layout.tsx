import { useUIStore } from "@/hooks/store/use-ui-store";
import { useBootDocumentState } from "@/ui/modules/boot-loader";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { IdentityLogin } from "@/ui/modules/identity/identity-login";
import { BlankOverlayContainer } from "@/ui/shared/containers/blank-overlay-container";
import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { DynamicBackground } from "./components/background/dynamic-background";
import { LandingHeader } from "./components/landing-header";
import { LandingMusicPlayer } from "./components/landing-music-player";
import { LandingSettings } from "./components/landing-settings";
import { LandingSidebar } from "./components/landing-sidebar";
import { MobileBottomNav } from "./components/mobile-bottom-nav";
import { LandingProvider, useLandingContext } from "./context/landing-context";
import { resolveLandingSurfacePath, type LandingEntryRouteState } from "./lib/landing-entry-state";

// Route to background mapping
const ROUTE_BACKGROUNDS: Record<string, string> = {
  "/": "02",
  "/learn": "02",
  "/news": "02",
  "/factory": "02",
  "/markets": "02",
  "/amm": "02",
  "/leaderboard": "07",
};

/**
 * Main layout wrapper for the new unified landing page.
 * Features:
 * - Full-bleed dynamic background with crossfade transitions
 * - Icon-only sidebar on desktop with wallet connector
 * - Bottom tab bar on mobile
 * - Minimal top header with navigation
 */
export const LandingLayout = () => {
  const location = useLocation();
  const surfacePath = resolveLandingSurfacePath({
    pathname: location.pathname,
    state: location.state as LandingEntryRouteState | null,
  });

  // Get default background for current route
  const routeBackground = ROUTE_BACKGROUNDS[surfacePath] ?? "02";

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
  useBootDocumentState("app-ready");

  const location = useLocation();
  const surfacePath = resolveLandingSurfacePath({
    pathname: location.pathname,
    state: location.state as LandingEntryRouteState | null,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { backgroundId, resetBackground } = useLandingContext();

  // Reset background when route changes
  useEffect(() => {
    resetBackground();
  }, [resetBackground, surfacePath]);

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

      {/* Top header with landing controls */}
      <LandingHeader
        headerControls={
          <>
            <LandingMusicPlayer className="hidden lg:flex" presentation="header" />
            <IdentityLogin />
          </>
        }
        onSettingsClick={handleSettingsClick}
      />

      {/* Main content area */}
      <main
        className={cn(
          "relative z-10 h-screen",
          // Padding for header and sidebar/bottom nav
          "pt-20 pb-24 lg:pb-8 lg:pl-16",
          "flex flex-col",
          "overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent",
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
      <MobileBottomNav />

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
    <BlankOverlayContainer
      zIndex={120}
      open={showModal}
      onPointerDown={onOverlayDown}
      className="bg-black/75 backdrop-blur-[2px]"
    >
      {modalContent}
    </BlankOverlayContainer>
  );
};
