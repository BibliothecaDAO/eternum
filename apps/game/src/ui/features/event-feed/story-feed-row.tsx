import {
  battleRollsOf,
  extractRoleLabel,
  findSegmentValue,
  normalizePresentationTroops,
  parsePresentationDescription,
} from "@/ui/features/story-events/story-event-utils";
import { useGoToStructure, useNavigateToMapView, useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { relicChestShares } from "@bibliothecadao/types";
import { Position, configManager, structureMapPosition, entityMapPosition } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { formatClockTime } from "@bibliothecadao/types";
import { HudEventRow } from "@/ui/design-system/kit/hud-elements";
import { storyPayloadId } from "@/utils/native-id";

function resolveStoryEventPosition(event: ProcessedStoryEvent, store: NativeFactStore): Position | null {
  const coord = event.storyPayload.end_coord ?? event.storyPayload.coord;
  if (coord && typeof coord === "object" && "x" in coord && "y" in coord) {
    return Position.fromContract({ x: Number(coord.x), y: Number(coord.y) });
  }
  // Battle stories contain participant IDs but no historical hex. Resolve surviving entities from native facts.
  for (const id of [event.storyPayload.defender_id, event.entity_id, event.storyPayload.attacker_id]) {
    if (id == null) continue;
    const key = { game_id: configManager.getActiveGameId(), entity_id: storyPayloadId(id) };
    const structure = store.get("Structure", key);
    const site = structure && structureMapPosition(store, structure);
    if (site) return Position.fromContract(site);
    const army = store.get("ExplorerTroops", { game_id: key.game_id, explorer_id: key.entity_id });
    if (army) return Position.fromContract(entityMapPosition(store, army.game_id, army.explorer_id));
  }
  return null;
}

/** Where an opened chest's reward is held: the army or its home structure, whichever got most of them. */
type ChestHolder = { kind: "army"; id: number } | { kind: "structure"; id: number; position: Position };

/**
 * LORDS go to the recorded home. Relic packs select the army or home that received most of them; that older story
 * needs the surviving army's row to resolve its home.
 */
function storyChestHolder(event: ProcessedStoryEvent, store: NativeFactStore): ChestHolder | null {
  if (event.story === "RewardChestOpened" && event.storyPayload.structure_id != null) {
    const id = storyPayloadId(event.storyPayload.structure_id);
    const home = store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: id });
    const site = home && structureMapPosition(store, home);
    return site ? { kind: "structure", id, position: Position.fromContract(site) } : null;
  }
  if (event.story !== "RelicChestOpened" || event.storyPayload.explorer_id == null) return null;
  const game_id = configManager.getActiveGameId();
  const explorerId = storyPayloadId(event.storyPayload.explorer_id);
  const army = store.get("ExplorerTroops", { game_id, explorer_id: explorerId });
  if (!army) return null;
  const { toArmy, toHome } = relicChestShares((event.storyPayload.relics as number[]).map(Number));
  if (toArmy >= toHome) return { kind: "army", id: explorerId };
  const home = store.get("Structure", { game_id, entity_id: army.owner });
  const site = home && structureMapPosition(store, home);
  return site ? { kind: "structure", id: safeInteger(army.owner), position: Position.fromContract(site) } : null;
}

/**
 * Opens a story where it happened, for the Events card and the log alike. An opened crate's row selects what holds
 * its reward: a LORDS chest's realm, an army pack's army (from the realm view, on the world map once it is shown), a structure pack's realm.
 * Any other row, or a crate whose army is gone, flies to its tile. Null when the story has no place left to show.
 */
export function useStoryOpener(event: ProcessedStoryEvent): (() => void) | null {
  const {
    setup,
    setup: { store },
  } = useGame();
  useNativeRevision(["Structure", "ExplorerTroops", "TileOccupancy"]);
  const navigate = useNavigateToMapView();
  const selectArmy = useSelectArmyOnMap();
  const goToStructure = useGoToStructure(setup);
  const { isMapView } = useQuery();
  const holder = storyChestHolder(event, store);
  const position = resolveStoryEventPosition(event, store);
  if (holder?.kind === "structure") return () => void goToStructure(holder.id, holder.position, isMapView);
  if (holder) return () => selectArmy(holder.id);
  return position ? () => navigate(position) : null;
}

/** A world story in the Log: what happened and its line (a fight's sides, forces and rolls), and its time. */
export const StoryFeedRow = ({ event }: { event: ProcessedStoryEvent }) => {
  const open = useStoryOpener(event);
  return (
    <HudEventRow
      time={formatClockTime(event.timestampMs / 1000)}
      tip={open ? event.presentation.description : "This event’s location is no longer available"}
      onOpen={open ?? undefined}
    >
      {event.story === "BattleEvent" ? (
        <BattleDetails description={event.presentation.description} />
      ) : (
        <span className="flex flex-col">
          <span className="truncate">{event.presentation.title}</span>
          <span className="line-clamp-2 text-hud-label text-hud-muted">{event.presentation.description}</span>
        </span>
      )}
    </HudEventRow>
  );
};

function BattleDetails({ description }: { description?: string }) {
  const segments = parsePresentationDescription(description);
  const attacker = extractRoleLabel(description, "Attacker");
  const defender = extractRoleLabel(description, "Defender");
  const forces = (role: string) =>
    normalizePresentationTroops(findSegmentValue(segments, (label) => label === `${role} forces`));
  const outcome = findSegmentValue(segments, (label) => label === "Outcome");
  const rolls = battleRollsOf(description);
  return (
    <span className="flex flex-col">
      <span className="flex gap-1">
        <span aria-hidden>⚔</span>
        <span className="truncate">
          {attacker} <span className="text-hud-muted">vs</span> {defender}
        </span>
      </span>
      <span className="text-hud-label text-hud-muted">
        {forces("Attacker")} vs {forces("Defender")}
      </span>
      {rolls && (
        <span className="text-hud-label text-hud-muted">
          d20 {rolls.attacker} vs {rolls.defender}
        </span>
      )}
      {outcome && <span className="text-hud-label text-hud-good">{outcome}</span>}
    </span>
  );
}
