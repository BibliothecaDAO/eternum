import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useGoToStructure } from "@/hooks/helpers/use-navigate";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudIconButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { type RealmLevelUp, useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { canIssueOrders, useActNowRefusal } from "@/utils/can-issue-orders";
import { Position, structureMapPosition } from "@bibliothecadao/eternum";
import type { ID, Structure } from "@bibliothecadao/types";
import { useEffect, useState } from "react";
import { useStructureAttention } from "@/ui/features/world/containers/top-header/use-structure-attention";
import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { useNextUpShows } from "./next-up-shows";
import type { NextStep } from "./next-step";
import { useCoachSteps, useLostArmyAlert } from "./use-coach-steps";

/** Tells the screen whether Next up shows a step with its button, and that it shows none once it unmounts. */
const usePublishShown = (step: NextStep | undefined) => {
  const showing = step !== undefined && (step.kind === "level-up" || (step.verb !== null && step.run !== null));
  useEffect(() => {
    useNextUpShows.setState({ showing });
  }, [showing]);
  useEffect(() => {
    return () => useNextUpShows.setState({ showing: false, act: null });
  }, []);
};

/**
 * The one thing to do now: the step that scores most for the player's state, with the others a tap away. First the
 * alerts: structures under attack or with arrivals, and an army just lost. Then, as tips, the coach's steps ranked by
 * what scores (raise an army where troops are on hand, open a crate beside an army, explore, go for a crate, a camp or
 * rift, a Hyperstructure, or level up first where the army would surely lose), then the selected realm's level-up. The
 * build order's steps are the Build order panel's alone. Tips off (Settings) leaves the alerts alone. Its button is the
 * screen's one primary action; before play opens it waits, saying when play starts.
 */
export const NextUp = () => <NextUpView steps={useNextSteps()} refusal={useActNowRefusal()} />;

/**
 * Next up as it draws its steps: the current one (the first), or one the player pages to. Paging is a look, not a
 * choice: once the current step changes, Next up is back on it. Its button is the screen's one primary action until
 * another surface holds the action at hand: an open action surface (an order's or an attack's preview), or what the
 * caller says `yields` to (a phone's pinned order). Then it steps down to secondary.
 */
export const NextUpView = ({
  steps,
  refusal = null,
  yields = false,
  compact = false,
}: {
  steps: NextStep[];
  refusal?: string | null;
  yields?: boolean;
  /**
   * Folded to the current step's line, one tap from its full step (Frontier on a phone; owner, 22 October 2026: mobile
   * direction A, the map first). Its fold folds it back.
   */
  compact?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const surfaceOpen = usePopoverStore((state) => state.surface !== null);
  const kind = yields || surfaceOpen ? "secondary" : "primary";
  const [paged, setPaged] = useState<{ from: string; to: string } | null>(null);
  const current = steps[0] as NextStep | undefined;
  // A look lives only as long as the step it was taken from is current: it ends there, never to come back.
  if (paged && current?.key !== paged.from) setPaged(null);
  const step = (paged && current?.key === paged.from && steps.find(({ key }) => key === paged.to)) || current;
  usePublishShown(step);
  if (!step || !current) return null;
  const index = steps.indexOf(step);
  const pageOn = () => {
    const next = steps[(index + 1) % steps.length];
    setPaged(next === current ? null : { from: current.key, to: next.key });
  };
  if (compact && !open)
    return (
      <button
        type="button"
        aria-label={`Next up: ${stepLine(step)}`}
        onClick={() => setOpen(true)}
        className="ui ui-panel pointer-events-auto min-h-11 w-full justify-center px-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon name="target" size={20} />
          <span className="min-w-0 flex-1 truncate text-hud-body text-hud-ink">{stepLine(step)}</span>
          <Icon name="chevron-up" size={16} />
        </span>
      </button>
    );
  return (
    <HudPanel
      label="Next up"
      title="Next up"
      collapsible={!compact}
      cue={
        <>
          {steps.length > 1 && (
            <HudButton kind="quiet" size="sm" onClick={pageOn}>
              {index + 1} of {steps.length} ›
            </HudButton>
          )}
          {compact && (
            <HudIconButton
              icon="chevron-down"
              label="Fold Next up"
              kind="quiet"
              size="sm"
              onClick={() => setOpen(false)}
            />
          )}
        </>
      }
    >
      {step.kind === "level-up" ? (
        <LevelUpStep key={step.key} realmId={step.realmId} name={step.name} why={step.why} kind={kind} />
      ) : (
        <StepBody line={step.line} verb={step.verb} busy={step.busy} refusal={refusal} run={step.run} kind={kind} />
      )}
    </HudPanel>
  );
};

/** A step's words in one line: its own line, or a level-up's realm. */
const stepLine = (step: NextStep): string => (step.kind === "level-up" ? `${step.name} can level up.` : step.line);

/** Next up's button: the screen's primary action, or secondary while another surface holds it. */
type StepKind = "primary" | "secondary";

/** A step's line and its one button; a step taken on the map has no button, and before play the button waits. */
const StepBody = ({
  line,
  verb,
  busy,
  disabled = false,
  refusal = null,
  run,
  kind,
}: {
  line: string;
  verb: string | null;
  busy: boolean;
  disabled?: boolean;
  refusal?: string | null;
  run: (() => void) | null;
  kind: StepKind;
}) => {
  const ready = verb !== null && run !== null && !busy && !disabled && refusal === null;
  usePublishAct(ready ? run : null);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-hud-body text-hud-ink">{line}</p>
      {verb !== null && run !== null && (
        <HudButton
          kind={kind}
          busy={busy ? "Sending…" : undefined}
          disabled={disabled || refusal !== null}
          onClick={run}
        >
          {verb}
        </HudButton>
      )}
      {verb !== null && refusal !== null && <p className="text-hud-label text-hud-muted">{refusal}</p>}
    </div>
  );
};

/** Hands `Space` the shown step's action while it can be taken, and takes it back when the step changes or goes. */
const usePublishAct = (act: (() => void) | null) => {
  useEffect(() => {
    useNextUpShows.setState({ act });
    return () => useNextUpShows.setState({ act: null });
  }, [act]);
};

/**
 * A realm's level-up step as its hook reads it, whichever realm it is: the same readiness, send and lock as its card;
 * its line is the reason the step asks for it, until the level-up is sent or refused, which its state says.
 */
const LevelUpStep = ({ realmId, name, why, kind }: { realmId: ID; name: string; why?: string; kind: StepKind }) => {
  const levelUp = useRealmLevelUp(realmId);
  if (!levelUp) return null;
  const settled = levelUp.loading || levelUp.refusal;
  return (
    <StepBody
      line={why && !settled ? why : levelUpLine(levelUp, name)}
      verb={levelUp.word}
      busy={levelUp.loading}
      disabled={!levelUp.ready}
      run={levelUp.run}
      kind={kind}
    />
  );
};

const levelUpLine = (levelUp: RealmLevelUp, name: string): string => {
  if (levelUp.loading) return `${name}: sent, waiting for the game.`;
  if (levelUp.refusal) return `${name}: ${levelUp.refusal.toLowerCase()}.`;
  if (levelUp.mode === "max") return `${name} is fully upgraded.`;
  return levelUp.mode === "provision" ? `${name} is ready to be provisioned.` : `${name} can level up.`;
};

function useNextSteps(): NextStep[] {
  const ordersAllowed = useUIStore(canIssueOrders);
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const levelUp = useRealmLevelUp(structureEntityId);
  const attention = useAttentionSteps();
  const lostArmy = useLostArmyAlert();
  const coach = useCoachSteps();
  const tips = useWorldAppearanceStore((state) => state.nextUpTips);
  const structures = useFactView(playerStructuresView);
  const mode = useGameModeConfig();
  if (!ordersAllowed) return [];

  const selected = structures.find((structure) => structure.entityId === structureEntityId);
  const offersLevelUp = selected && levelUp && (levelUp.ready || levelUp.loading);
  const levelUpStep: NextStep[] = offersLevelUp
    ? [
        {
          key: `level-up:${selected.entityId}`,
          kind: "level-up",
          realmId: selected.entityId,
          name: mode.structure.getName(selected.structure).name,
        },
      ]
    : [];
  const alerts = [...attention, ...lostArmy];
  // A lost army's alert already says where to raise the next one.
  const route = lostArmy.length > 0 ? coach.filter(({ key }) => !RAISE_KEYS.has(key)) : coach;
  // With tips off (Settings), Next up holds the alerts alone, and shows nothing without one.
  return tips ? [...alerts, ...route, ...levelUpStep] : alerts;
}

/** The coach's steps for an empty field: raising an army, or the barracks it needs first. */
const RAISE_KEYS = new Set(["coach:raise", "coach:barracks"]);

/** Structures under attack or with arrivals waiting, each as a step that shows it. */
function useAttentionSteps(): NextStep[] {
  const { setup } = useGame();
  const mode = useGameModeConfig();
  const goToStructure = useGoToStructure(setup);
  const { attackedIds, targets } = useStructureAttention();
  // Those under attack first, then those with arrivals.
  const attention = [
    ...targets
      .filter(({ entityId }) => attackedIds.has(entityId))
      .map((structure) => ({ structure, reason: "attacked" })),
    ...targets
      .filter(({ entityId }) => !attackedIds.has(entityId))
      .map((structure) => ({ structure, reason: "arrived" })),
  ];

  const show = (structure: Structure) => {
    const position = structureMapPosition(setup.store, structure.structure);
    if (position) void goToStructure(structure.entityId, Position.fromContract(position), true);
  };
  return attention.map(({ structure, reason }) => {
    const name = mode.structure.getName(structure.structure).name;
    return {
      key: `${reason}:${structure.entityId}`,
      kind: "order",
      line: reason === "attacked" ? `${name} is under attack.` : `Resources arrived at ${name}.`,
      verb: `Show ${name}`,
      busy: false,
      run: () => show(structure),
    };
  });
}
