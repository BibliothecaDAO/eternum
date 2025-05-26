import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { HeadContent } from "@tanstack/react-router";
import { TopBar } from "@/components/layout/TopBar";
// import { WaveformBackground } from "@/components/WaveformBackground";
import { motion } from "framer-motion";
import { FooterSection } from "@/components/sections/FooterSection";
// import AsciiArt from "@/components/ascii";

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
      <FooterSection />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}
