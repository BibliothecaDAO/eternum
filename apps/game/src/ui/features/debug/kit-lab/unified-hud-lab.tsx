import { useDocumentClass } from "@/hooks/use-document-class";
import { useHudMode } from "@/hooks/use-hud-mode";
import { FrontierHud } from "@/ui/features/frontier/frontier-hud";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { DesktopHud } from "@/ui/features/world/hud/desktop-hud";
import { readExpeditionRules } from "@bibliothecadao/eternum";
import { useParams } from "react-router-dom";

import { LabGame } from "./lab-game";

/** The views the lab draws: each mode's player, and a spectator of a game running and of one finished. */
const VIEWS = {
  blitz: { preset: 2, spectating: false, finished: false },
  frontier: { preset: 5, spectating: false, finished: false },
  "blitz-spectator": { preset: 2, spectating: true, finished: false },
  "blitz-finished": { preset: 2, spectating: true, finished: true },
} as const;

type View = keyof typeof VIEWS;

/**
 * Dev only: the in-game HUD on a desktop as the game mounts it, every mode's, on the lab's game, at
 * /lab/kit/unified/<view>: blitz, frontier, blitz-spectator, blitz-finished. Frontier's states on the same HUD are the
 * Frontier HUD lab's, /lab/kit/hud/<state>.
 */
export const UnifiedHudLab = () => {
  const { view = "blitz" } = useParams();
  const shown: View = view in VIEWS ? (view as View) : "blitz";
  return <ViewLab key={shown} view={shown} />;
};

const ViewLab = ({ view }: { view: View }) => {
  const { preset, spectating, finished } = VIEWS[view];
  const frontier = preset === VIEWS.frontier.preset;
  useDocumentClass(frontier ? "frontier-hud" : "classic-hud");
  useHudMode(frontier ? "frontier" : "blitz");
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,theme(colors.kit.line),theme(colors.kit.ground))]"
      />
      <LabGame preset={preset} spectating={spectating} finished={finished}>
        {(store) => {
          const rules = frontier ? readExpeditionRules(store, 1) : null;
          return frontier ? (
            rules && <FrontierHud rules={rules} />
          ) : (
            <>
              <TopHeader />
              <DesktopHud />
            </>
          );
        }}
      </LabGame>
    </>
  );
};
