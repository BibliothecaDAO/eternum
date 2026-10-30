import { useResolvedWorldGameMode } from "@/config/game-modes/use-game-mode-config";
import { saveBuildOrders, useBuildOrderFailure, useBuildOrders } from "@/hooks/use-build-orders";
import { BuildOrderFailure } from "@/ui/features/build-orders/build-order-failure";
import { BUILD_ORDERS_PATH } from "@/shell/build-orders/build-orders-route";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudIconButton, HudPanel, HudRow, HudSelect } from "@/ui/design-system/kit/hud-elements";
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
import type { BuildOrderBook } from "@bibliothecadao/eternum/automation";
import type { ReactNode } from "react";

/**
 * The Build order panel (the owner's pick, build-order-2): at its head the choice of the order to follow (one saved on
 * the player's account, or the game's) and the way to the app's Build orders page, where orders are made; then each
 * realm's next step under it,
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
  const { book, status } = useBuildOrders();
  const failed = useBuildOrderFailure() !== null;
  const { handleSuggestionClick, pendingSuggestionIds } = useSuggestionActions();
  const refusal = useActNowRefusal();
  return (
    <BuildOrderView
      choice={
        // Signed in with the account's orders unread, no order is followed: the choice waits for them.
        book || status === "signed-out" ? (
          <OrderChoice
            book={book}
            busy={status === "loading" || status === "saving"}
            onFollow={(active) => book && void saveBuildOrders({ ...book, active })}
          />
        ) : null
      }
      onOrders={openBuildOrdersPage}
      notice={failed ? <BuildOrderFailure /> : null}
    >
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

/** The app's Build orders page, opened beside the game so the game keeps running. */
const openBuildOrdersPage = () => window.open(BUILD_ORDERS_PATH, "_blank", "noopener");

/** The game's own order in the choice: it needs no saving, and it is what an account with none follows. */
const GAMES_ORDER = "";

/**
 * Which order the panel follows: the account's saved orders and the game's. Following one saves only that choice; while
 * the account's orders are being read or saved, or signed out with none, the choice holds.
 */
export const OrderChoice = ({
  book,
  busy,
  onFollow,
}: {
  book: BuildOrderBook | null;
  busy: boolean;
  onFollow: (active: string | null) => void;
}) => (
  <HudSelect
    label={BUILD_ORDER_WORDS.follow}
    value={book?.active ?? GAMES_ORDER}
    options={[
      ...(book?.orders ?? []).map(({ id, order }) => ({ value: id, label: order.name })),
      { value: GAMES_ORDER, label: BUILD_ORDER_WORDS.theGamesOrder },
    ]}
    disabled={busy || !book}
    onChange={(active) => onFollow(active === GAMES_ORDER ? null : active)}
  />
);

/** Each order step's verb: a build builds, an army opens its deployment. */
export const STEP_VERBS: Record<Exclude<EmpireSuggestion["action"], "upgrade">, string> = {
  build: BUILD_ORDER_WORDS.build,
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

/**
 * The panel as drawn: the choice of order at its head with the way to the page where orders are made, why the account's
 * orders failed when they did, its rows, or the line that says there is nothing now.
 */
export const BuildOrderView = ({
  choice,
  onOrders,
  notice = null,
  children,
}: {
  choice: ReactNode;
  onOrders: () => void;
  /** Why the account's orders could not be read or saved, with Try again: said above the rows, never hidden. */
  notice?: ReactNode;
  children: ReactNode[];
}) => (
  <HudPanel
    label={BUILD_ORDER_WORDS.title}
    title={BUILD_ORDER_WORDS.title}
    icon="build"
    cue={
      <span className="flex items-center gap-1">
        {choice}
        <HudIconButton icon="edit" label={BUILD_ORDER_WORDS.makeOrders} kind="quiet" size="sm" onClick={onOrders} />
      </span>
    }
    bodyClassName="flex flex-col"
  >
    {notice}
    {children.some(Boolean)
      ? children
      : !notice && <p className="text-hud-label text-hud-muted">{BUILD_ORDER_WORDS.nothingNow}</p>}
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
