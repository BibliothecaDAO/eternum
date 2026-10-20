import { useDocumentClass } from "@/hooks/use-document-class";
import { useHudMode } from "@/hooks/use-hud-mode";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { PlotConstructionPicker } from "@/ui/features/settlement/construction/plot-construction-picker";
import { readBuildingTiles } from "@bibliothecadao/eternum";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { BLITZ_PLOT, BLITZ_REALM_ID, installBlitzBuildRealm } from "./blitz-build-fixture";
import { LabGame } from "./lab-game";

/**
 * Dev only: Blitz's "Build on this plot" panel as it ships (the owner's pick, option C · List and detail), the real
 * picker on the lab's Blitz realm with the owner's nine resources and Simple cost off, as he plays. At
 * /lab/kit/blitz-build; ?case=start for a realm that holds little.
 */
export const BlitzBuildLab = () => {
  const [params] = useSearchParams();
  const stocked = params.get("case") !== "start";
  useDocumentClass("classic-hud");
  useHudMode("blitz");
  return <BuildPanel key={String(stocked)} stocked={stocked} />;
};

const BuildPanel = ({ stocked }: { stocked: boolean }) => {
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
            <Link className={cn(stocked && "underline")} to="?case=stocked">
              Stocked
            </Link>
            <Link className={cn(!stocked && "underline")} to="?case=start">
              Start
            </Link>
          </nav>
          <div className="w-full max-w-[26rem] rounded bg-[#1d2a2c] p-3">
            <PlotConstructionPicker
              entityId={BLITZ_REALM_ID}
              spot={BLITZ_PLOT}
              // The panel reads the realm's tiles only; nothing here sends a call.
              tileManager={readBuildingTiles(store, {} as Parameters<typeof readBuildingTiles>[1], BLITZ_REALM_ID)}
              isCurrentTarget={() => true}
            />
          </div>
        </main>
      )}
    </LabGame>
  );
};
