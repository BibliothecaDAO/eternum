import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
// import { WaveformBackground } from "@/components/WaveformBackground";
import { motion } from "framer-motion";
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
  return (
    <>
      <HeadContent />
      {/* <AsciiArt /> */}
      {/* Fixed position background */}
      <div className="fixed inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[70vh]" />
      </div>

      {/* Scrollable content */}
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <TopBar />
        <div className="min-h-screen pt-12 sm:pt-16 md:pt-24 mx-1 sm:mx-2 md:mx-4">
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
