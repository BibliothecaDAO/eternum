import { useCallback, useEffect, useRef, useState } from "react";
import { HexExplorerCanvas } from "./HexExplorerCanvas";
import { HexExplorerUI } from "./HexExplorerUI";
import type { AgentData, FeatureHexData, PixelCoord } from "./types";

export function HexExplorerSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [activeFeature, setActiveFeature] = useState<FeatureHexData | null>(
    null
  );
  const [activeAgent, setActiveAgent] = useState<AgentData | null>(null);
  const [agentScreenPos, setAgentScreenPos] = useState<PixelCoord | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Measure container dimensions ──────────────────────────────────
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    function measure() {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
      setIsMobile(rect.width < 640);
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  // ── IntersectionObserver for activation ────────────────────────────
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsActive(entry.isIntersecting && entry.intersectionRatio > 0.5);
        }
      },
      { threshold: [0, 0.5, 1] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // ── Auto-hide hint after 3s ───────────────────────────────────────
  useEffect(() => {
    if (!isActive || !showHint) return;

    hintTimeoutRef.current = setTimeout(() => {
      setShowHint(false);
    }, 4000);

    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    };
  }, [isActive, showHint]);

  // ── Callbacks ─────────────────────────────────────────────────────
  const handleFeatureActivate = useCallback(
    (feature: FeatureHexData | null) => {
      setActiveFeature(feature);
    },
    []
  );

  const handleAgentNearby = useCallback(
    (agent: AgentData | null, screenPos: PixelCoord | null) => {
      setActiveAgent(agent);
      setAgentScreenPos(screenPos);
    },
    []
  );

  const handleFirstInput = useCallback(() => {
    setShowHint(false);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen overflow-hidden -mx-1 sm:-mx-2 md:-mx-4"
      style={{ scrollSnapAlign: "start", width: "100vw" }}
      role="application"
      aria-label="Interactive hex grid explorer"
      tabIndex={0}
    >
      {/* Skip link for accessibility */}
      <a
        href="#agent-native"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:border focus:border-border focus:rounded"
      >
        Skip interactive section
      </a>

      {/* Canvas */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <HexExplorerCanvas
          width={dimensions.width}
          height={dimensions.height}
          isActive={isActive}
          onFeatureHexActivate={handleFeatureActivate}
          onAgentNearby={handleAgentNearby}
          onFirstInput={handleFirstInput}
        />
      )}

      {/* React UI overlay */}
      <HexExplorerUI
        activeFeature={activeFeature}
        activeAgent={activeAgent}
        agentScreenPos={agentScreenPos}
        showHint={showHint && isActive}
        isMobile={isMobile}
      />
    </section>
  );
}
