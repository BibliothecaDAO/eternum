import { DEEP_WORDS } from "@/ui/design-system/kit/words";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { sendOnce } from "@/hooks/store/use-actions-in-flight";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudCost, HudRow, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { costLine } from "@/ui/design-system/kit/price-faces";
import { ARMY, dayLeft, MOVE, RESEARCH, depthName, SPIRE_WORDS, STAMINA, WORLD } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import {
  armyAtItsSpire,
  armySpireChance,
  configManager,
  entityMapPosition,
  expeditionDayEndsAt,
  expeditionSpires,
  type ExpeditionSpireView,
  isAtExpeditionSpire,
  isViewerOwner,
  readExpeditionRules,
} from "@bibliothecadao/eternum";
import { formatHeldAgainst } from "@bibliothecadao/types";
import type { Account } from "starknet";

import { reachMark } from "./depth-art";
import { useOrderAt } from "./hud/army-order";
import { type DockArmy, useDockArmies } from "./hud/dock-armies";
import { useApproachTile } from "./sites/approach";

const SPIRE_MODELS = [
  "ArmySlot",
  "ArmyDay",
  "GameRegistry",
  "SliceRules",
  "SettlementRules",
  "ExplorerTroops",
  "Structure",
  "RealmKnowledge",
  "TileOccupancy",
  "DeepRules",
  "ExpeditionSpire",
] as const;

type Spire = ExpeditionSpireView;

/**
 * The lit spire on the tile the selection names, with its realm; null otherwise. An army selected on or beside its
 * spire is the army's panel, like an army on any site (owner, 28 October 2026: tapping a tile with his army on it selects
 * the army, whatever site is under it): its spire's card opens from Spire on that panel (SpireButton), or a tap on the
 * spire's tile. The shared Spire reader resolves both the selected card and the map marker.
 */
export const useSelectedSpire = (): Spire | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedHex);
  const now = useCurrentBlockTimestamp();
  useNativeRevision(SPIRE_MODELS);
  if (!isMapView || !selected) return null;
  return (
    expeditionSpires(setup.store, configManager.getActiveGameId(), now).find(
      (spire) => spire.col === selected.col && spire.row === selected.row,
    ) ?? null
  );
};

/** The army's discovery chance, or the way into its found Spire while it stands beside it. */
export const useArmySpireStatus = (explorerId: number) => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const now = useCurrentBlockTimestamp();
  useNativeRevision(SPIRE_MODELS);
  if (!isMapView) return null;
  const gameId = configManager.getActiveGameId();
  const spire = armyAtItsSpire(setup.store, gameId, explorerId, now);
  if (spire) return <SpireButton explorerId={explorerId} spire={spire} />;
  const chance = armySpireChance(setup.store, gameId, explorerId, now);
  return chance === null ? null : (
    <p data-spire-chance className="text-hud-small text-hud-ink">
      {SPIRE_WORDS.nextReveal(chance)}
    </p>
  );
};

/**
 * The way from an army's panel to its spire's card, while the army stands on or beside the spire: the army stays
 * selected and the card acts for it, as a tap on the spire's tile does.
 */
const SpireButton = ({ explorerId, spire }: { explorerId: number; spire: Spire }) => (
  <HudButton
    kind="secondary"
    size="sm"
    icon={reachMark(1)}
    onClick={() =>
      useUIStore
        .getState()
        .selectOnMap({ kind: "army", entityId: explorerId, tile: { col: spire.col, row: spire.row } })
    }
  >
    {SPIRE_WORDS.title}
  </HudButton>
);

/**
 * A spire's card, whatever the player brought to it. Another realm's says so. The player's own names the army it acts
 * for (the selected one, else one standing beside it) and offers the destination its Spire opens: the
 * landing's availability, then Enter, the one step to go. It says
 * that entering keeps the army there for the rest of the day, since no command brings it back up; the next depth
 * points at its research; an army away from the spire gets the move beside it.
 */
export const RealmSpireSheet = ({
  spire,
  onResearch,
  onClose,
}: {
  spire: Spire;
  /** Opens Research, where the next depth is bought. */
  onResearch: () => void;
  onClose: () => void;
}) => {
  const own = isViewerOwner(spire.realm.owner, useAccountAddress());
  return (
    <HudSheet label={SPIRE_WORDS.title} onClose={onClose}>
      {own ? (
        <OwnSpire spire={spire} onResearch={onResearch} />
      ) : (
        <p className="text-hud-body text-hud-ink">{SPIRE_WORDS.foreign}</p>
      )}
    </HudSheet>
  );
};

const OwnSpire = ({ spire, onResearch }: { spire: Spire; onResearch: () => void }) => {
  const { setup, account } = useGame();
  const { store, systemCalls } = setup;
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const now = useCurrentBlockTimestamp();
  useNativeRevision(SPIRE_MODELS);
  const armies = useDockArmies(spire.realm);
  const gameId = configManager.getActiveGameId();
  const rules = readExpeditionRules(store, gameId);
  if (!rules) throw new Error("A spire stands only in an expedition game");
  const at = (army: DockArmy) => entityMapPosition(store, gameId, army.explorerId);
  const actor =
    selectedId === null
      ? armies.find((army) => isAtExpeditionSpire(spire, at(army)))
      : armies.find((army) => army.explorerId === selectedId);
  const position = actor && at(actor);
  const sourceDepth = spire.targetDepth === 3 ? 2 : spire.targetDepth === 2 ? 1 : 0;
  const depthNow = actor?.ethereal ?? sourceDepth;
  const beside = position !== undefined && depthNow === sourceDepth && isAtExpeditionSpire(spire, position);
  const approach = useOrderAt(useApproachTile(spire, actor !== undefined && depthNow === sourceDepth && !beside));

  const sharedDeep = store.get("DeepRules", { game_id: gameId }) !== undefined;
  const depthLabel = (depth: 0 | 1 | 2 | 3) =>
    depth === 0 ? WORLD : depth === 3 && sharedDeep ? DEEP_WORDS.title : depthName(depth);
  const offered = spire.targetDepth === undefined ? ([1, 2, 3] as const) : [spire.targetDepth];
  const depths = offered.filter((depth) => depth <= spire.deepest);
  const next = offered.find((depth) => depth > spire.deepest);
  const choice = (depth: 1 | 2 | 3) => {
    if (!actor || !position || !beside) return { why: null, open: false };
    if (spire.targetDepth !== undefined || (depth === 3 && sharedDeep)) return { why: null, open: true };
    const landing = { game_id: gameId, alt: false, col: position.x, row: position.y + depth * rules.spacing };
    if (store.get("TileOccupancy", landing)) return { why: SPIRE_WORDS.landingTaken, open: false };
    return { why: null, open: true };
  };

  const enter = (army: DockArmy, depth: number) =>
    sendOnce("army", army.explorerId, { order: "move" }, () =>
      systemCalls.enter_depth({
        signer: account.account as unknown as Account,
        explorerId: army.explorerId,
        depth,
      }),
    ).catch((error: unknown) => toast.failed(error, "The army could not enter the Spire."));

  const stamina = actor?.stamina && formatHeldAgainst(actor.stamina.current, actor.stamina.max);
  return (
    <div className="flex flex-col gap-2">
      {actor ? (
        <div className="flex flex-wrap items-center gap-2">
          <HudChip icons={[actor.art]} label={ARMY}>
            {actor.label}
          </HudChip>
          {stamina && (
            <HudChip icons={["stamina"]} label={STAMINA}>
              {`${stamina.held} / ${stamina.need}`}
            </HudChip>
          )}
        </div>
      ) : (
        <p className="text-hud-body text-hud-ink">{SPIRE_WORDS.pickArmy}</p>
      )}
      {actor && depthNow !== sourceDepth && (
        <p className="text-hud-body text-hud-ink">{SPIRE_WORDS.inDepth(actor.label, depthLabel(depthNow))}</p>
      )}
      {actor && depthNow === sourceDepth && !beside && (
        <>
          <p className="text-hud-body text-hud-ink">{SPIRE_WORDS.away(actor.label)}</p>
          {approach && (
            <div className="flex items-center gap-2">
              <HudButton kind="primary" icon="move" onClick={() => requestOrderAt(approach.target)}>
                {MOVE}
              </HudButton>
              <HudCost
                line={costLine([
                  { of: "stamina", amount: approach.stamina.cost },
                  { of: "wheat", amount: approach.wheat.cost },
                ])}
              />
            </div>
          )}
        </>
      )}
      {depthNow === sourceDepth && (
        <div className="flex flex-col gap-1" data-spire-depths>
          {depths.map((depth) => {
            const { why, open } = choice(depth);
            return (
              <HudRow
                key={depth}
                lead={<Icon name={reachMark(depth)} size={22} />}
                title={depthLabel(depth)}
                detail={why ?? undefined}
                disabled={!open}
                controls={
                  <HudButton
                    kind="secondary"
                    size="sm"
                    disabled={!open}
                    aria-label={`${SPIRE_WORDS.enter} ${depthLabel(depth)}`}
                    onClick={() => actor && enter(actor, depth)}
                  >
                    {SPIRE_WORDS.enter}
                  </HudButton>
                }
              />
            );
          })}
          {next && (
            <HudRow
              lead={<Icon name={reachMark(next)} size={22} />}
              title={depthLabel(next)}
              detail={SPIRE_WORDS.locked}
              controls={
                <HudButton kind="secondary" size="sm" onClick={onResearch}>
                  {RESEARCH}
                </HudButton>
              }
            />
          )}
        </div>
      )}
      {actor && beside && (
        <p className="text-hud-body text-hud-ink" data-spire-commitment>
          {SPIRE_WORDS.commits(actor.label, dayLeft(expeditionDayEndsAt(rules, now) - now).reading)}
        </p>
      )}
    </div>
  );
};
