import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { AgentData, FeatureHexData, PixelCoord } from "./types";
import { Link } from "@tanstack/react-router";

interface HexExplorerUIProps {
  activeFeature: FeatureHexData | null;
  activeAgent: AgentData | null;
  agentScreenPos: PixelCoord | null;
  showHint: boolean;
  isMobile: boolean;
}

export function HexExplorerUI({
  activeFeature,
  activeAgent,
  agentScreenPos,
  showHint,
  isMobile,
}: HexExplorerUIProps) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* Onboarding hint */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            className="absolute bottom-24 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="realm-panel px-5 py-3 text-center pointer-events-auto">
              <p
                className="text-sm tracking-[0.1em] uppercase"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {isMobile ? "Swipe to explore" : "Arrow keys to explore"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feature panel */}
      <AnimatePresence>
        {activeFeature && (
          <motion.div
            key={activeFeature.symbol + activeFeature.coord.q}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[90vw] max-w-md pointer-events-auto"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="realm-panel p-5">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className="text-lg font-bold"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: featureUIColor(activeFeature.type),
                  }}
                >
                  {activeFeature.symbol}
                </span>
                <span
                  className="text-xs uppercase tracking-[0.12em] text-foreground/60"
                  style={{ fontFamily: "var(--font-ui)" }}
                >
                  {activeFeature.type}
                </span>
              </div>
              <h3
                className="text-base font-semibold text-foreground mb-1"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {activeFeature.label}
              </h3>
              <p className="text-sm text-foreground/70 leading-relaxed mb-3">
                {activeFeature.description}
              </p>
              {activeFeature.link && (
                <FeatureLink link={activeFeature.link} type={activeFeature.type} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent speech bubble */}
      <AnimatePresence>
        {activeAgent && agentScreenPos && (
          <motion.div
            key={`agent-${activeAgent.id}`}
            className="absolute pointer-events-none"
            style={{
              left: agentScreenPos.x,
              top: agentScreenPos.y - 40,
              transform: "translateX(-50%)",
            }}
            initial={{ opacity: 0, y: 5, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            transition={{ duration: 0.25 }}
          >
            <div
              className="px-3 py-1.5 rounded-md border text-xs whitespace-nowrap"
              style={{
                fontFamily: "var(--font-mono)",
                background: "rgba(15, 15, 30, 0.85)",
                borderColor: "rgba(122, 106, 170, 0.5)",
                color: "rgba(122, 106, 170, 0.9)",
                backdropFilter: "blur(4px)",
              }}
            >
              {activeAgent.phrase}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll hint at bottom */}
      <motion.div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 3, duration: 0.8 }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.2em] text-foreground/40"
          style={{ fontFamily: "var(--font-ui)" }}
        >
          Scroll to continue
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-foreground/30" />
      </motion.div>
    </div>
  );
}

/** Render the CTA link for feature hexes. */
function FeatureLink({
  link,
  type,
}: {
  link: string;
  type: FeatureHexData["type"];
}) {
  const label = type === "game" ? "Play Now" : "Learn More";

  // Internal links use tanstack router Link
  if (link.startsWith("/")) {
    return (
      <Link
        to={link}
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary hover:text-primary/80 transition-colors"
        style={{ fontFamily: "var(--font-ui)" }}
      >
        {label}
        <span aria-hidden="true">&rarr;</span>
      </Link>
    );
  }

  // External links
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary hover:text-primary/80 transition-colors"
      style={{ fontFamily: "var(--font-ui)" }}
    >
      {label}
      <span aria-hidden="true">&rarr;</span>
    </a>
  );
}

function featureUIColor(type: FeatureHexData["type"]): string {
  switch (type) {
    case "game":
      return "#c8a855";
    case "lore":
      return "#7a6aaa";
    case "agent":
      return "#7a6aaa";
    case "token":
      return "#c8a855";
    case "community":
      return "#7a6aaa";
  }
}
