import { useUIStore } from "@/hooks/store/use-ui-store";
import clsx from "clsx";
import type { TransitionEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BlankOverlayContainer } from "../shared/containers/blank-overlay-container";
import { LANDING_BACKGROUNDS } from "./landing-backgrounds";

interface LandingLayoutProps {
  backgroundImage: string;
  backgroundVideo?: string;
}

const SECTIONS = [
  { label: "Overview", path: "/" },
  { label: "Cosmetics", path: "/cosmetics" },
  // { label: "Account", path: "/account" },
  { label: "Player", path: "/player" },
  { label: "Markets", path: "/markets" },
  { label: "Leaderboard", path: "/leaderboard" },
];

// Served from client/public/images/landing/wooden-panel.png
const LANDING_NAV_PANEL_IMAGE = "/images/landing/wooden-panel.png";

export const LandingLayout = ({ backgroundImage, backgroundVideo }: LandingLayoutProps) => {
  const location = useLocation();

  const resolvedBackground = useMemo(() => {
    const normalizedPath = location.pathname.toLowerCase();
    const matchedKey = Object.keys(LANDING_BACKGROUNDS).find(
      (key) => normalizedPath === key || normalizedPath.startsWith(`${key}/`),
    );

    if (matchedKey) {
      return LANDING_BACKGROUNDS[matchedKey];
    }

    return backgroundImage;
  }, [backgroundImage, location.pathname]);

  const [currentBackground, setCurrentBackground] = useState(resolvedBackground);
  const [transitionBackground, setTransitionBackground] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (backgroundVideo) {
      return;
    }

    if (resolvedBackground === currentBackground || resolvedBackground === transitionBackground) {
      return;
    }

    if (typeof Image === "undefined") {
      setTransitionBackground(resolvedBackground);
      return;
    }

    let isActive = true;
    const loader = new Image();
    loader.src = `/images/covers/blitz/${resolvedBackground}.png`;

    const handleReady = () => {
      if (!isActive) {
        return;
      }

      setTransitionBackground(resolvedBackground);
    };

    loader.addEventListener("load", handleReady);
    loader.addEventListener("error", handleReady);

    return () => {
      isActive = false;
      loader.removeEventListener("load", handleReady);
      loader.removeEventListener("error", handleReady);
    };
  }, [backgroundVideo, currentBackground, resolvedBackground, transitionBackground]);

  useEffect(() => {
    if (backgroundVideo) {
      return;
    }

    if (!transitionBackground) {
      return;
    }

    setIsTransitioning(false);

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      const frame = window.requestAnimationFrame(() => setIsTransitioning(true));

      return () => {
        window.cancelAnimationFrame(frame);
        setIsTransitioning(false);
      };
    }

    const timeout = window.setTimeout(() => setIsTransitioning(true), 0);

    return () => {
      window.clearTimeout(timeout);
      setIsTransitioning(false);
    };
  }, [backgroundVideo, transitionBackground]);

  useEffect(() => {
    if (!backgroundVideo) {
      return;
    }

    if (resolvedBackground !== currentBackground) {
      setCurrentBackground(resolvedBackground);
    }
  }, [backgroundVideo, currentBackground, resolvedBackground]);

  const handleTransitionEnd = (event: TransitionEvent<HTMLImageElement>) => {
    if (event.propertyName !== "opacity" || !transitionBackground) {
      return;
    }

    setCurrentBackground(transitionBackground);
    setTransitionBackground(null);
    setIsTransitioning(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-black text-gold">
      <div className="absolute inset-0">
        <img
          alt="Eternum background"
          src={`/images/covers/blitz/${currentBackground}.png`}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {!backgroundVideo && transitionBackground ? (
          <img
            alt="Eternum background"
            src={`/images/covers/blitz/${transitionBackground}.png`}
            className={clsx(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              isTransitioning ? "opacity-100" : "opacity-0",
            )}
            onTransitionEnd={handleTransitionEnd}
          />
        ) : null}

        {backgroundVideo ? (
          <video
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
            loop
            muted
            playsInline
            poster={`/images/covers/blitz/${currentBackground}.png`}
            preload="auto"
          >
            <source src={backgroundVideo} type="video/mp4" />
          </video>
        ) : null}

        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Global modal container for landing routes */}
        <LandingModalHost />
        <header className="flex flex-col gap-6 px-6 pt-0 lg:px-10">
          <nav aria-label="Landing sections" className="flex justify-center">
            <div className="relative flex w-full max-w-[720px] justify-center sm:px-4">
              <img
                alt=""
                aria-hidden="true"
                src={"/borders/top-bar.png"}
                loading="lazy"
                className="w-full hidden sm:block select-none object-contain pointer-events-none"
              />
              <div className="sm:absolute inset-0 flex items-center justify-center px-6 py-4 sm:px-8  sm:-mt-6">
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                  {SECTIONS.map((section) => (
                    <NavLink
                      key={section.path}
                      to={section.path}
                      end={section.path === "/"}
                      className={({ isActive }) =>
                        clsx(
                          "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                          isActive ? "bg-gold/5" : "text-gold/50 hover:bg-gold/5",
                        )
                      }
                    >
                      {section.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        </header>

        <main className="mx-auto flex w-full sm:flex-1 flex-col items-center justify-center lg:px-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

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
