import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import type { TransitionEvent } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Controller } from "../modules/controller/controller";
import { LANDING_BACKGROUNDS } from "./landing-backgrounds";

interface LandingLayoutProps {
  backgroundImage: string;
}

const SECTIONS = [
  { label: "Overview", path: "/" },
  { label: "Cosmetics", path: "/cosmetics" },
  { label: "Account", path: "/account" },
  { label: "Leaderboard", path: "/leaderboard" },
];

export const LandingLayout = ({ backgroundImage }: LandingLayoutProps) => {
  const location = useLocation();

  const resolvedBackground = useMemo(() => {
    const normalizedPath = location.pathname.toLowerCase();
    const matchedKey = Object.keys(LANDING_BACKGROUNDS).find((key) =>
      normalizedPath === key || normalizedPath.startsWith(`${key}/`)
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
  }, [currentBackground, resolvedBackground, transitionBackground]);

  useEffect(() => {
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
  }, [transitionBackground]);

  const handleTransitionEnd = (event: TransitionEvent<HTMLImageElement>) => {
    if (event.propertyName !== "opacity" || !transitionBackground) {
      return;
    }

    setCurrentBackground(transitionBackground);
    setTransitionBackground(null);
    setIsTransitioning(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black text-gold">
      <div className="absolute inset-0">
        <img
          alt="Eternum background"
          src={`/images/covers/blitz/${currentBackground}.png`}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {transitionBackground ? (
          <img
            alt="Eternum background"
            src={`/images/covers/blitz/${transitionBackground}.png`}
            className={clsx(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              isTransitioning ? "opacity-100" : "opacity-0"
            )}
            onTransitionEnd={handleTransitionEnd}
          />
        ) : null}

        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex flex-col gap-6 px-6 py-6 lg:px-10">
          <div className="flex justify-end">
            <Controller />
          </div>

          <nav aria-label="Landing sections" className="flex justify-center">
            <div className="flex flex-wrap gap-2 rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur">
              {SECTIONS.map((section) => (
                <NavLink
                  key={section.path}
                  to={section.path}
                  end={section.path === "/"}
                  className={({ isActive }) =>
                    clsx(
                      "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                      isActive ? "bg-white/20 text-white" : "text-white/70 hover:text-white"
                    )
                  }
                >
                  {section.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </header>

        <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center px-6 py-10 lg:px-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
