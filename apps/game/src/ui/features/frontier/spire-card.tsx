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
import { ARMY, dayLeft, MOVE, depthName, SPIRE_WORDS, STAMINA } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import {
  armyAtItsSpire,
  type FoundSpire,
  configManager,
  entityMapPosition,
  expeditionDayEndsAt,
  expeditionDepth,
  expeditionSpires,
  knowsSpireLore,
  nextSpireOdds,
  realmSpireToday,
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

const SPIRE_MODELS = ["ArmySlot", "ExplorerTroops", "Structure", "RealmKnowledge", "TileOccupancy"] as const;

type Spire = FoundSpire;

/**
 * The spire found today on the tile the selection names, with its realm; null otherwise. An army selected on or beside its
 * spire is the army's panel, like an army on any site (owner, 28 October 2026: tapping a tile with his army on it selects
 * the army, whatever site is under it): its spire's card opens from Spire on that panel (SpireButton), or a tap on the
 * spire's tile. A spire is the one its realm found today on that layer (ExpeditionSpire).
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

/** The spire of the army's realm while the army stands on it or beside it; null elsewhere or off the map. */
export const useArmyAtItsSpire = (explorerId: number): Spire | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const now = useCurrentBlockTimestamp();
  useNativeRevision(SPIRE_MODELS);
  return isMapView ? armyAtItsSpire(setup.store, configManager.getActiveGameId(), explorerId, now) : null;
};

/**
 * The odds that the realm's next reveal on an army's layer finds the day's spire there (rising with each reveal, so the
 * last finds it), while the realm knows Spire lore and has not found it yet; null otherwise, and in the Deep, which has
 * no spire.
 */
const useArmySpireOdds = (explorerId: number): number | null => {
  const { setup } = useGame();
  const now = useCurrentBlockTimestamp();
  useNativeRevision(SPIRE_ODDS_MODELS);
  const gameId = configManager.getActiveGameId();
  const rules = readExpeditionRules(setup.store, gameId);
  const army = setup.store.get("ExplorerTroops", { game_id: gameId, explorer_id: explorerId });
  const tile = army && setup.store.entityOccupancy(gameId, explorerId);
  const realm = army && setup.store.get("Structure", { game_id: gameId, entity_id: army.owner });
  if (!rules || !tile || !realm || !knowsSpireLore(setup.store, gameId, realm.entity_id)) return null;
  const depth = expeditionDepth(rules, { y: tile.row });
  return depth < 3 ? nextSpireOdds(realmSpireToday(setup.store, realm, depth, now)) : null;
};

const SPIRE_ODDS_MODELS = ["ExpeditionSpire", "ExplorerTroops", "RealmKnowledge", "TileOccupancy"] as const;

/** On an army's panel, while its realm looks for the day's spire on the army's layer: the next reveal's odds. */
export const SpireOdds = ({ explorerId }: { explorerId: number }) => {
  const odds = useArmySpireOdds(explorerId);
  return odds === null ? null : (
    <HudChip icons={[reachMark(1)]} label={SPIRE_WORDS.title}>
      {SPIRE_WORDS.odds(odds)}
    </HudChip>
  );
};

/**
 * The way from an army's panel to its spire's card, while the army stands on or beside the spire: the army stays
 * selected and the card acts for it, as a tap on the spire's tile does.
 */
export const SpireButton = ({ explorerId, spire }: { explorerId: number; spire: Spire }) => (
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
 * for (the selected one, else one standing beside it) and offers that army the one layer the spire leads down to: Enter,
 * the one step to go. It says that entering keeps the army there for the rest of the day, since no command brings it
 * back up; an army away from the spire on its layer gets the move beside it.
 */
export const RealmSpireSheet = ({ spire, onClose }: { spire: Spire; onClose: () => void }) => {
  const own = isViewerOwner(spire.realm.owner, useAccountAddress());
  return (
    <HudSheet label={SPIRE_WORDS.title} onClose={onClose}>
      {own ? <OwnSpire spire={spire} /> : <p className="text-hud-body text-hud-ink">{SPIRE_WORDS.foreign}</p>}
    </HudSheet>
  );
};

const OwnSpire = ({ spire }: { spire: Spire }) => {
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
  const onItsLayer = (army: DockArmy) => (army.ethereal ?? 0) === spire.depth;
  const actor =
    selectedId === null
      ? armies.find((army) => onItsLayer(army) && isAtExpeditionSpire(spire, at(army)))
      : armies.find((army) => army.explorerId === selectedId);
  const position = actor && at(actor);
  const sameLayer = actor !== undefined && onItsLayer(actor);
  const beside = position !== undefined && sameLayer && isAtExpeditionSpire(spire, position);
  const approach = useOrderAt(useApproachTile(spire, sameLayer && !beside));
  const below = (spire.depth + 1) as 1 | 2 | 3;

  const enter = (army: DockArmy) =>
    sendOnce("army", army.explorerId, { order: "move" }, () =>
      systemCalls.enter_depth({
        signer: account.account as unknown as Account,
        explorerId: army.explorerId,
        depth: below,
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
      {actor && !sameLayer && <p className="text-hud-body text-hud-ink">{SPIRE_WORDS.elsewhere(actor.label)}</p>}
      {actor && sameLayer && !beside && (
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
      <div className="flex flex-col gap-1" data-spire-depths>
        <HudRow
          lead={<Icon name={reachMark(below)} size={22} />}
          title={depthName(below)}
          disabled={!beside}
          controls={
            <HudButton
              kind="secondary"
              size="sm"
              disabled={!beside}
              aria-label={`${SPIRE_WORDS.enter} ${depthName(below)}`}
              onClick={() => actor && enter(actor)}
            >
              {SPIRE_WORDS.enter}
            </HudButton>
          }
        />
      </div>
      {actor && beside && (
        <p className="text-hud-body text-hud-ink" data-spire-commitment>
          {SPIRE_WORDS.commits(actor.label, dayLeft(expeditionDayEndsAt(rules, now) - now).reading)}
        </p>
      )}
    </div>
  );
};
