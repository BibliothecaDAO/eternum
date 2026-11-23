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
import type { ReactNode } from "react";

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
    <BuildOrderView>
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

export const STEP_VERBS: Record<Exclude<EmpireSuggestion["action"], "upgrade">, string> = {
  build: BUILD_ORDER_WORDS.build,
  "deploy-army": BUILD_ORDER_WORDS.deploy,
};

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

export const BuildOrderView = ({ children }: { children: ReactNode[] }) => (
  <HudPanel label={BUILD_ORDER_WORDS.title} title={BUILD_ORDER_WORDS.title} icon="build" bodyClassName="flex flex-col">
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
    controls={
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
