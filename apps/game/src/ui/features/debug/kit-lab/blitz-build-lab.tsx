import { useDocumentClass } from "@/hooks/use-document-class";
import { useHudMode } from "@/hooks/use-hud-mode";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { SurfaceHost } from "@/ui/design-system/molecules/popover";
import { PlotConstructionPicker } from "@/ui/features/settlement/construction/plot-construction-picker";
import { readBuildingTiles } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { BLITZ_PLOT, BLITZ_REALM_ID, installBlitzBuildRealm } from "./blitz-build-fixture";
import { LabGame } from "./lab-game";

/**
 * Dev only: Blitz's "Build on this plot" panel as it ships (the owner's pick, option C · List and detail), the real
 * picker on the lab's Blitz realm with the owner's nine resources and Simple cost off, as he plays. At
 * /lab/kit/blitz-build; ?case=start for a realm that holds little; ?case=plot for the panel as the realm view opens
 * it, hanging from a plot a little below the middle of the screen, where changing its tab must not move it.
 */
export const BlitzBuildLab = () => {
  const [params] = useSearchParams();
  const lab = params.get("case");
  const stocked = lab !== "start";
  useDocumentClass("classic-hud");
  useHudMode("blitz");
  return <BuildPanel key={lab ?? "stocked"} stocked={stocked} onPlot={lab === "plot"} />;
};

/** The picker on the lab's realm and plot; it reads the realm's tiles only, and nothing here sends a call. */
const LabPicker = ({ store }: { store: NativeFactStore }) => (
  <PlotConstructionPicker
    entityId={BLITZ_REALM_ID}
    spot={BLITZ_PLOT}
    tileManager={readBuildingTiles(store, {} as Parameters<typeof readBuildingTiles>[1], BLITZ_REALM_ID)}
    isCurrentTarget={() => true}
  />
);

/**
 * The plot the panel hangs from, marked, as the realm view anchors it on a clicked hex: across the middle and a little
 * low, as in the player's report (feedback-20261025 img-3), where the Resources tab has no room below and hangs above.
 */
const PlotPopup = ({ store }: { store: NativeFactStore }) => {
  const [plot] = useState(() => ({ x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight * 0.55) }));
  useEffect(() => {
    usePopoverStore.getState().openSurface({
      id: "plot-construction",
      anchor: { left: plot.x, right: plot.x, top: plot.y, bottom: plot.y },
      content: <LabPicker store={store} />,
    });
    return () => usePopoverStore.getState().close("plot-construction");
  }, [plot, store]);
  return (
    <>
      <span
        aria-label="The plot"
        className="fixed h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold"
        style={{ left: plot.x, top: plot.y }}
      />
      <SurfaceHost />
    </>
  );
};

const BuildPanel = ({ stocked, onPlot }: { stocked: boolean; onPlot: boolean }) => {
  useState(() => useUIStore.setState({ useSimpleCost: false }));
  return (
    <LabGame
      preset={2}
      facts={(store) => {
        installBlitzBuildRealm(store, stocked);
        return [];
      }}
    >
      {(store) => (
        <main className="flex min-h-screen flex-col gap-3 bg-[#0b1418] p-2 md:p-4">
          <nav className="flex gap-3 text-xs text-white">
            <Link className={cn(stocked && !onPlot && "underline")} to="?case=stocked">
              Stocked
            </Link>
            <Link className={cn(!stocked && "underline")} to="?case=start">
              Start
            </Link>
            <Link className={cn(onPlot && "underline")} to="?case=plot">
              On a plot
            </Link>
          </nav>
          {onPlot ? (
            <PlotPopup store={store} />
          ) : (
            <div className="w-full max-w-[26rem] rounded bg-[#1d2a2c] p-3">
              <LabPicker store={store} />
            </div>
          )}
        </main>
      )}
    </LabGame>
  );
};
