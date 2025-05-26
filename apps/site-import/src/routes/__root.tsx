import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { TopBar } from "@/components/layout/TopBar";
// import { WaveformBackground } from "@/components/WaveformBackground";
import { motion } from "framer-motion";
import { FooterSection } from "@/components/sections/FooterSection";
// import AsciiArt from "@/components/ascii";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
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
