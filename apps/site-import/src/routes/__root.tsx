import {
  createRootRoute,
  HeadContent,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
// import { WaveformBackground } from "@/components/WaveformBackground";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
// import AsciiArt from "@/components/ascii";

const RouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((module) => ({
        default: module.TanStackRouterDevtools,
      }))
    )
  : null;

const FooterSection = lazy(() =>
  import("@/components/sections/FooterSection").then((module) => ({
    default: module.FooterSection,
  }))
);
const RealmSceneBackground = lazy(() =>
  import("@/components/RealmSceneBackground").then((module) => ({
    default: module.RealmSceneBackground,
  }))
);

function DeferredFooter() {
  const [isVisible, setIsVisible] = useState(false);
  const footerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isVisible) return;

    const node = footerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "450px 0px" }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={footerRef}>
      {isVisible ? (
        <Suspense fallback={<div className="min-h-[440px]" />}>
          <FooterSection />
        </Suspense>
      ) : (
        <div className="min-h-[440px]" />
      )}
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  head: () => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://realms.world";

    return {
      meta: [
        {
          title: "Realms World - Onchain Gaming Powered by $LORDS",
        },
        {
          name: "description",
          content:
            "The future of gaming is onchain. Explore games powered by $LORDS token in the Realms ecosystem.",
        },
        {
          property: "og:title",
          content: "Realms World - Onchain Gaming Powered by $LORDS",
        },
        {
          property: "og:description",
          content:
            "The future of gaming is onchain. Explore games powered by $LORDS token in the Realms ecosystem.",
        },
        {
          property: "og:image",
          content: `${origin}/og.png`,
        },
        {
          property: "og:url",
          content: origin,
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:title",
          content: "Realms World - Onchain Gaming Powered by $LORDS",
        },
        {
          name: "twitter:description",
          content:
            "The future of gaming is onchain. Explore games powered by $LORDS token in the Realms ecosystem.",
        },
        {
          name: "twitter:image",
          content: `${origin}/og.png`,
        },
      ],
    };
  },
});

function RootComponent() {
  const location = useLocation();
  const isBlitzRoute = location.pathname === "/blitz";
  const isEternumRoute = location.pathname === "/eternum";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <>
      <HeadContent />
      {/* <AsciiArt /> */}
      {/* Fixed position background */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(246,194,122,0.17),transparent_42%),radial-gradient(circle_at_80%_8%,rgba(106,127,227,0.18),transparent_35%),linear-gradient(180deg,rgba(13,15,22,0.97),rgba(11,11,15,0.94))]" />
        <Suspense fallback={null}>
          <RealmSceneBackground />
        </Suspense>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,11,0.06),rgba(8,8,11,0.35))]" />
      </div>

      {/* Scrollable content */}
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <TopBar />
        <div
          className={cn(
            isBlitzRoute || isEternumRoute
              ? "min-h-screen"
              : "min-h-screen pt-12 sm:pt-16 md:pt-24 mx-1 sm:mx-2 md:mx-4"
          )}
        >
          <Outlet />
        </div>
      </motion.div>
      <DeferredFooter />
      {RouterDevtools ? (
        <Suspense fallback={null}>
          <RouterDevtools position="bottom-right" />
        </Suspense>
      ) : null}
    </>
  );
}
