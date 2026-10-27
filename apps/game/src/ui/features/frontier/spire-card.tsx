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
import { staminaShortfall } from "@/ui/design-system/kit/reasons";
import { ARMY, dayLeft, MOVE, RESEARCH, depthName, SPIRE_WORDS, STAMINA } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import {
  armyAtItsSpire,
  configManager,
  entityMapPosition,
  expeditionDayEndsAt,
  expeditionDepth,
  expeditionSpires,
  isAtExpeditionSpire,
  isViewerOwner,
  readExpeditionRules,
} from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatCharge, formatHeldAgainst } from "@bibliothecadao/types";
import type { Account } from "starknet";

import { reachMark } from "./depth-art";
import { useOrderAt } from "./hud/army-order";
import { type DockArmy, useDockArmies } from "./hud/dock-armies";
import { useApproachTile } from "./sites/approach";

const SPIRE_MODELS = ["ArmySlot", "ExplorerTroops", "Structure", "RealmKnowledge", "TileOccupancy"] as const;

type Spire = { col: number; row: number; deepest: number; realm: NativeRows["Structure"] };

/**
 * The lit spire the selection is about, with its realm: the one on the tile the player tapped, else the one the
 * selected army stands on or beside (useSelectedArmySpire); null otherwise. Research draws it by rule and no occupancy
 * marks it, so it is found from the same rules the map draws it by.
 */
export const useSelectedSpire = (): Spire | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedHex);
  const now = useCurrentBlockTimestamp();
  const armySpire = useSelectedArmySpire();
  useNativeRevision(SPIRE_MODELS);
  if (!isMapView) return null;
  const tapped =
    selected &&
    expeditionSpires(setup.store, configManager.getActiveGameId(), now).find(
      (spire) => spire.col === selected.col && spire.row === selected.row,
    );
  return tapped || armySpire;
};

/**
 * The spire of the selected army's realm while the army stands on it or beside it: entering a depth is what an army
 * there is for, so selecting it opens the spire's card. An army deployed onto its spire's own tile is selected by any
 * tap on that tile, so without this its card, and Enter, never opened.
 */
export const useSelectedArmySpire = (): Spire | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const now = useCurrentBlockTimestamp();
  useNativeRevision(SPIRE_MODELS);
  if (!isMapView || selectedId === null) return null;
  return armyAtItsSpire(setup.store, configManager.getActiveGameId(), selectedId, now);
};

/**
 * A spire's card, whatever the player brought to it. Another realm's says so. The player's own names the army it acts
 * for (the selected one, else one standing beside it) and offers that army each depth its realm has researched: the
 * entry's stamina, or why it cannot go (short of stamina, its landing taken), then Enter, the one step to go. It says
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
  const depthNow = position ? expeditionDepth(rules, position) : 0;
  const beside = position !== undefined && depthNow === 0 && isAtExpeditionSpire(spire, position);
  const approach = useOrderAt(useApproachTile(spire, actor !== undefined && depthNow === 0 && !beside));

  const depths = ([1, 2, 3] as const).filter((depth) => depth <= spire.deepest);
  const next = ([1, 2, 3] as const).find((depth) => depth === spire.deepest + 1);
  const choice = (depth: 1 | 2 | 3) => {
    const cost = store.require("DepthRules", { game_id: gameId, depth }).entry_stamina;
    if (!actor || !position || !beside) return { cost, why: null, open: false };
    // enter_depth lands the army straight below where it stands, one region down per depth.
    const landing = { game_id: gameId, alt: false, col: position.x, row: position.y + depth * rules.spacing };
    const stamina = actor.stamina?.current;
    if (stamina === undefined) return { cost, why: null, open: false };
    if (stamina < cost) return { cost, why: staminaShortfall(stamina, cost), open: false };
    if (store.get("TileOccupancy", landing)) return { cost, why: SPIRE_WORDS.landingTaken, open: false };
    return { cost, why: null, open: true };
  };

  const enter = (army: DockArmy, depth: number) =>
    sendOnce("army", army.explorerId, { order: "move" }, () =>
      systemCalls.enter_depth({
        signer: account.account as unknown as Account,
        explorerId: army.explorerId,
        depth,
      }),
    ).catch((error: unknown) => toast.failed(error, "The army could not enter the depth."));

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
      {actor && depthNow > 0 && (
        <p className="text-hud-body text-hud-ink">
          {SPIRE_WORDS.inDepth(actor.label, depthName(depthNow as 1 | 2 | 3))}
        </p>
      )}
      {actor && depthNow === 0 && !beside && (
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
      {depthNow === 0 && (
        <div className="flex flex-col gap-1" data-spire-depths>
          {depths.map((depth) => {
            const { cost, why, open } = choice(depth);
            return (
              <HudRow
                key={depth}
                lead={<Icon name={reachMark(depth)} size={22} />}
                title={depthName(depth)}
                detail={why ?? SPIRE_WORDS.cost(formatCharge(cost))}
                disabled={!open}
                trail={
                  <HudButton
                    kind="secondary"
                    size="sm"
                    disabled={!open}
                    aria-label={`${SPIRE_WORDS.enter} ${depthName(depth)}`}
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
              title={depthName(next)}
              detail={SPIRE_WORDS.locked}
              trail={
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
