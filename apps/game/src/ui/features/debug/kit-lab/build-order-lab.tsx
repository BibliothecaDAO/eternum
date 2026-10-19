import { useDocumentClass } from "@/hooks/use-document-class";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudPanel, HudRow, HudWindow } from "@/ui/design-system/kit/hud-elements";
import type { NextStep } from "@/ui/features/world/hud/next-step";
import { NextUpView } from "@/ui/features/world/hud/next-up";
import type { ReactNode } from "react";

/**
 * One realm's build order as the Blitz suggestion rules walk it (packages/core/src/automation/blitz-suggestions.ts,
 * buildBlitzRealmSuggestions): level up, wheat farms to the level's target, then wood, coal and copper (two of each per
 * realm level), then T1 military; a worker hut whenever population comes within 3 of its cap. The fixture realm is a
 * City (level 1): its farms are built and its second wood camp is next.
 */
type BuildStep = { key: string; icon: IconMeaning; name: string; built: number; target: number };

const REALM = { name: "Egonal", level: "City" };
const ORDER: BuildStep[] = [
  { key: "level", icon: "realm-1", name: "Level up to City", built: 1, target: 1 },
  { key: "wheat", icon: "farm", name: "Wheat farms", built: 4, target: 4 },
  { key: "wood", icon: "wood", name: "Wood camps", built: 1, target: 2 },
  { key: "coal", icon: "coal", name: "Coal mines", built: 0, target: 2 },
  { key: "copper", icon: "copper", name: "Copper mines", built: 0, target: 2 },
  { key: "military", icon: "barracks", name: "Knight barracks", built: 0, target: 1 },
];
const NEXT = ORDER.find((step) => step.built < step.target)!;
const HUT_RULE = "A worker hut comes first whenever population is 3 from full.";

const run = () => undefined;

/** The points coach's step, as Next up shows it today with an army idle. */
const EXPLORE_STEP: NextStep = {
  key: "coach:explore",
  kind: "order",
  line: "Your army can explore: +5 points a tile.",
  verb: "Select the army",
  busy: false,
  run,
};

/** Today: the build step is the realm's suggestion, ranked after the coach's, so it waits behind the pager. */
const TODAY_STEPS: NextStep[] = [
  EXPLORE_STEP,
  {
    key: "coach:crate",
    kind: "order",
    line: "A relic crate lies 2 tiles away: +250 points.",
    verb: "Show the crate",
    busy: false,
    run,
  },
  {
    key: "suggestion:wood",
    kind: "order",
    line: `${REALM.name}: Build more wood camps (1 of 2 built).`,
    verb: "Build wood camp",
    busy: false,
    run,
  },
];

/** A count only where there are several to build. */
const builtOf = (step: BuildStep) => (step.target > 1 ? `${step.built} of ${step.target}` : "");

/** A: Next up keeps the points step on top, and the realm's next building is its second, quieter line. */
const NextUpWithBuild = () => (
  <HudPanel
    label="Next up"
    title="Next up"
    cue={
      <HudButton kind="quiet" size="sm">
        1 of 2 ›
      </HudButton>
    }
  >
    <div className="flex flex-col gap-2">
      <p className="text-hud-body text-hud-ink">{EXPLORE_STEP.line}</p>
      <HudButton kind="primary">Select the army</HudButton>
    </div>
    <div className="mt-3 flex items-center gap-3 border-t border-hud-divider pt-3">
      <Icon name={NEXT.icon} size={32} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-hud-label text-hud-muted">Build · {REALM.name}</span>
        <span className="text-hud-body text-hud-ink">
          {NEXT.name} {builtOf(NEXT)}
        </span>
      </span>
      <HudButton kind="secondary" size="sm">
        Build
      </HudButton>
    </div>
  </HudPanel>
);

/** One step of the order: done, next (with its Build), or still to come. */
const OrderRow = ({ step }: { step: BuildStep }) => {
  const done = step.built >= step.target;
  const next = step === NEXT;
  return (
    <HudRow
      selected={next}
      lead={<Icon name={done ? "check" : step.icon} size={26} />}
      title={step.name}
      detail={<HudMeter share={step.built / step.target} tone={done ? "good" : undefined} label={step.name} />}
      trail={
        next ? (
          <HudButton kind="secondary" size="sm">
            Build
          </HudButton>
        ) : (
          <span className="text-hud-label text-hud-muted">{builtOf(step)}</span>
        )
      }
    />
  );
};

/** B: its own panel in the rail, under Next up: the realm's whole order, what is done, the next one with Build. */
const BuildOrderPanel = () => (
  <HudPanel
    label="Build order"
    title="Build order"
    icon="build"
    cue={<span className="text-hud-label text-hud-muted">{`${REALM.name} · ${REALM.level}`}</span>}
    bodyClassName="flex flex-col"
  >
    {ORDER.map((step) => (
      <OrderRow key={step.key} step={step} />
    ))}
    <p className="pt-2 text-hud-label text-hud-muted">{HUT_RULE}</p>
  </HudPanel>
);

/** C: the order across the top of the Build window, the next building lit with Build next; the rail is unchanged. */
const BuildWindowWithOrder = () => (
  <HudWindow title="Build" icon="build" size="page" onClose={run}>
    <div className="flex flex-col gap-4">
      <section aria-label="Build order" className="flex flex-col gap-2">
        <span className="text-hud-label text-hud-muted">Build order · {REALM.name}</span>
        <div className="flex flex-wrap items-center gap-2">
          {ORDER.map((step, index) => (
            <span key={step.key} className="flex items-center gap-2">
              {index > 0 && <span className="text-hud-muted">›</span>}
              <HudChip
                tone={step.built >= step.target ? "good" : step === NEXT ? "warn" : undefined}
                icons={[step.built >= step.target ? "check" : step.icon]}
              >
                {step.name} {builtOf(step)}
              </HudChip>
            </span>
          ))}
          <HudButton kind="primary" size="sm">
            Build next: {NEXT.name.replace(/s$/, "")}
          </HudButton>
        </div>
        <p className="text-hud-label text-hud-muted">{HUT_RULE}</p>
      </section>
      <p className="rounded border border-dashed border-hud-divider p-6 text-center text-hud-label text-hud-muted">
        The building groups, as the Build window draws them today
      </p>
    </div>
  </HudWindow>
);

const Option = ({
  name,
  line,
  wide = false,
  children,
}: {
  name: string;
  line: string;
  wide?: boolean;
  children: ReactNode;
}) => (
  <section data-sheet-element={name} className={`flex flex-col gap-2 ${wide ? "w-fit" : "w-hud-column"}`}>
    <h2 className="text-sm font-semibold text-white">{name}</h2>
    <p className="text-xs text-white/60">{line}</p>
    {children}
  </section>
);

/**
 * Dev only, for the owner's pick: where a realm's build order lives, at /lab/kit/build-order. Today's Next up beside
 * three options, each drawn with the HUD's own elements on one fixture realm.
 */
export const BuildOrderLab = () => {
  useDocumentClass("classic-hud");
  return (
    <div className="flex min-h-screen flex-wrap items-start gap-8 bg-[#0b1418] p-6">
      <Option
        name="Today"
        line="The build step still exists, but it ranks after the points coach's steps: here it is page 3 of 3, behind the pager."
      >
        <NextUpView steps={TODAY_STEPS} />
      </Option>
      <Option
        name="A · In Next up"
        line="The points step stays on top with the gold verb; the realm's next building is a second, quieter line with its own Build."
      >
        <NextUpWithBuild />
      </Option>
      <Option
        name="B · Its own panel"
        line="A Build order panel in the rail under Next up: the whole order for the selected realm, done ones checked, the next one with Build. Folds from its title."
      >
        <NextUpView steps={[EXPLORE_STEP]} />
        <BuildOrderPanel />
      </Option>
      <Option
        name="C · In the Build window"
        line="The order across the top of Build, the next building lit, with Build next. The rail is unchanged; the order shows when Build is open."
        wide
      >
        <BuildWindowWithOrder />
      </Option>
    </div>
  );
};
