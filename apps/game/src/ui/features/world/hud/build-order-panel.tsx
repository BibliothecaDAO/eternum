import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudPanel, HudRow } from "@/ui/design-system/kit/hud-elements";
import { BUILD_ORDER_WORDS } from "@/ui/design-system/kit/words";
import {
  type EmpireSuggestion,
  useEmpireSuggestions,
} from "@/ui/features/world/containers/left-facets/use-empire-suggestions";
import {
  isOrderSuggestion,
  useSuggestionActions,
} from "@/ui/features/world/containers/left-facets/use-suggestion-actions";
import { useRealmLevelUp } from "@/ui/modules/entity-details/hooks/use-realm-level-up";
import { canIssueOrders, useActNowRefusal } from "@/utils/can-issue-orders";
import { DEFAULT_BUILD_ORDER } from "@bibliothecadao/eternum/automation";
import type { ReactNode } from "react";

/**
 * The Build order panel (the owner's pick, build-order-2): the order at its head, then each realm's next step under it,
 * only once the step can be taken; a step done never shows. A level-up comes first, as it always does; a worker hut
 * comes when the next step needs the room. Self-contained: it reads the game it is drawn in, and draws nothing where
 * there is no build order to follow (outside a Blitz, or for a viewer who gives no orders). The rail places it under
 * Next up.
 */
export const BuildOrderPanel = () => {
  const blitz = useResolvedWorldGameMode() === "blitz";
  const ordersAllowed = useUIStore(canIssueOrders);
  if (!blitz || !ordersAllowed) return null;
  return <PlayersBuildOrder />;
};

const PlayersBuildOrder = () => {
  const steps = useEmpireSuggestions();
  const { handleSuggestionClick, pendingSuggestionIds } = useSuggestionActions();
  const refusal = useActNowRefusal();
  return (
    <BuildOrderView orderName={DEFAULT_BUILD_ORDER.name}>
      {steps.map((step) =>
        isOrderSuggestion(step) ? (
          <BuildOrderRow
            key={step.id}
            step={step}
            verb={STEP_VERBS[step.action]}
            busy={pendingSuggestionIds.includes(step.id)}
            refusal={refusal}
            onPress={() => void handleSuggestionClick(step).catch(() => undefined)}
          />
        ) : (
          <LevelUpRow key={step.id} step={step} />
        ),
      )}
    </BuildOrderView>
  );
};

/** Each order step's verb: a build builds, training opens Production, an army its deployment. */
export const STEP_VERBS: Record<Exclude<EmpireSuggestion["action"], "upgrade">, string> = {
  "build-copper": BUILD_ORDER_WORDS.build,
  "build-coal": BUILD_ORDER_WORDS.build,
  "build-military": BUILD_ORDER_WORDS.build,
  "build-wheat": BUILD_ORDER_WORDS.build,
  "build-wood": BUILD_ORDER_WORDS.build,
  "build-worker-hut": BUILD_ORDER_WORDS.build,
  "train-troops": BUILD_ORDER_WORDS.train,
  "deploy-army": BUILD_ORDER_WORDS.deploy,
};

/**
 * A realm's level-up, read and sent by the realm's own step, as every surface that offers it does. The level it reaches
 * is in the row's line, so its verb is as short as a build's and the line keeps its width.
 */
const LevelUpRow = ({ step }: { step: EmpireSuggestion }) => {
  const levelUp = useRealmLevelUp(step.realmId);
  if (!levelUp) return null;
  const named = levelUp.mode === "level-up" && levelUp.nextLevelName !== null;
  return (
    <BuildOrderRow
      step={named ? { ...step, reason: `It can level up to ${levelUp.nextLevelName} now.` } : step}
      verb={named ? BUILD_ORDER_WORDS.levelUp : levelUp.word}
      busy={levelUp.loading}
      refusal={levelUp.ready ? null : levelUp.refusal}
      onPress={levelUp.run}
    />
  );
};

/** The panel as drawn: the order's name at its head, its rows, or the line that says there is nothing now. */
export const BuildOrderView = ({ orderName, children }: { orderName: string; children: ReactNode[] }) => (
  <HudPanel
    label={BUILD_ORDER_WORDS.title}
    title={BUILD_ORDER_WORDS.title}
    icon="build"
    cue={<span className="text-hud-label text-hud-muted">{orderName}</span>}
    bodyClassName="flex flex-col"
  >
    {children.some(Boolean) ? (
      children
    ) : (
      <p className="text-hud-label text-hud-muted">{BUILD_ORDER_WORDS.nothingNow}</p>
    )}
  </HudPanel>
);

/** One realm's next step: its painting, the realm and the step, why, and its one verb. */
export const BuildOrderRow = ({
  step,
  verb,
  busy,
  refusal,
  onPress,
}: {
  step: { realmName: string; label: string; reason?: string; icon: IconMeaning };
  verb: string;
  busy: boolean;
  refusal: string | null;
  onPress: () => void;
}) => (
  <HudRow
    lead={<Icon name={step.icon} size={28} />}
    title={step.realmName}
    detail={step.reason ?? step.label}
    trail={
      <HudButton
        kind="secondary"
        size="sm"
        busy={busy ? "Sending…" : undefined}
        disabled={refusal !== null}
        data-tip={refusal ?? undefined}
        onClick={onPress}
      >
        {verb}
      </HudButton>
    }
  />
);
