import { useDocumentClass } from "@/hooks/use-document-class";
import type { IconMeaning } from "@/ui/design-system/icon";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudPanel, HudRow } from "@/ui/design-system/kit/hud-elements";
import { useHudMode } from "@/hooks/use-hud-mode";
import { FrontierHud } from "@/ui/features/frontier/frontier-hud";
import { TopHeader } from "@/ui/features/world/containers/top-header/top-header";
import { DesktopHud } from "@/ui/features/world/hud/desktop-hud";
import { readExpeditionRules } from "@bibliothecadao/eternum";
import { useParams } from "react-router-dom";

import { LabGame } from "./lab-game";

/**
 * The views the lab draws: each mode's player (Blitz's with one realm's build step, and with four realms' steps), and a
 * spectator of a game running and of one finished.
 */
const VIEWS = {
  blitz: { preset: 2, spectating: false, finished: false, steps: 1 },
  "blitz-build-order": { preset: 2, spectating: false, finished: false, steps: 4 },
  frontier: { preset: 5, spectating: false, finished: false, steps: 0 },
  "blitz-spectator": { preset: 2, spectating: true, finished: false, steps: 0 },
  "blitz-finished": { preset: 2, spectating: true, finished: true, steps: 0 },
} as const;

type View = keyof typeof VIEWS;

/**
 * Dev only: the in-game HUD on a desktop as the game mounts it, every mode's, on the lab's game, at
 * /lab/kit/unified/<view>: blitz, blitz-build-order, frontier, blitz-spectator, blitz-finished. Frontier's states on the
 * same HUD are the Frontier HUD lab's, /lab/kit/hud/<state>.
 */
export const UnifiedHudLab = () => {
  const { view = "blitz" } = useParams();
  const shown: View = view in VIEWS ? (view as View) : "blitz";
  return <ViewLab key={shown} view={shown} />;
};

const ViewLab = ({ view }: { view: View }) => {
  const { preset, spectating, finished, steps } = VIEWS[view];
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
              <DesktopHud buildOrder={steps > 0 && <BuildOrderStandIn steps={steps} />} />
            </>
          );
        }}
      </LabGame>
    </>
  );
};

/** A realm's next build step, as the Build order panel shows it (build-order-2's phase 1). */
type BuildStep = { realm: string; rank: string; icon: IconMeaning; step: string; verb: string; why: string };

const BUILD_STEPS: BuildStep[] = [
  { realm: "Stolsli", rank: "Settlement", icon: "wood", step: "Wood camp", verb: "Build", why: "1 of 2" },
  {
    realm: "Egonal",
    rank: "City",
    icon: "realm-2",
    step: "Level up to Kingdom",
    verb: "Level up",
    why: "Always first",
  },
  {
    realm: "Grimwatch",
    rank: "Settlement",
    icon: "workers-hut",
    step: "Worker hut",
    verb: "Build",
    why: "Pop. 5 of 6",
  },
  { realm: "Ashford", rank: "City", icon: "coal", step: "Coal mine", verb: "Build", why: "2 of 2" },
];

/**
 * A stand-in for the hud lane's Build order panel (build-order-3) until it lands, in the place the desktop HUD gives it:
 * the rail, under Next up. The same parts as its proposal: the order's name as the panel's cue, a row per realm whose
 * next step can be taken now, each with its one verb.
 */
const BuildOrderStandIn = ({ steps }: { steps: number }) => (
  <HudPanel
    label="Build order"
    title="Build order"
    icon="build"
    cue={<span className="text-hud-label text-hud-muted">Default · djizus</span>}
    className="pointer-events-auto"
    bodyClassName="flex flex-col"
  >
    {BUILD_STEPS.slice(0, steps).map((step) => (
      <HudRow
        key={step.realm}
        lead={<Icon name={step.icon} size={28} />}
        title={`${step.realm} · ${step.step}`}
        detail={`${step.rank} · ${step.why}`}
        trail={
          <HudButton kind="secondary" size="sm">
            {step.verb}
          </HudButton>
        }
      />
    ))}
  </HudPanel>
);
