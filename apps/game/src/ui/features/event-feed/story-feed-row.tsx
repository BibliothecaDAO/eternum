import {
  battleRollsOf,
  extractRoleLabel,
  findSegmentValue,
  formatWinnerName,
  normalizePresentationTroops,
  parsePresentationDescription,
} from "@/ui/features/story-events/story-event-utils";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { Position, configManager, structureMapPosition, entityMapPosition } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { requestArmySelection } from "@/three/scenes/worldmap-army-select-request";
import { formatFeedTime } from "./important-feed-rows";
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

/** The army a story's relics went to, while it stands: an opened crate pays army relics to the army that opened it. */
function storyRelicArmy(event: ProcessedStoryEvent, store: NativeFactStore): number | null {
  if (event.story !== "RelicChestOpened" || event.storyPayload.explorer_id == null) return null;
  const explorerId = storyPayloadId(event.storyPayload.explorer_id);
  return store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: explorerId })
    ? explorerId
    : null;
}

/**
 * Opens a story where it happened, for the Events card and the log alike: an opened crate's row selects the army that
 * holds its relics (on the world map; from the realm view it flies there), any other row, or a crate whose army is
 * gone, flies to its tile. Null when the story has no place left to show.
 */
export function useStoryOpener(event: ProcessedStoryEvent): (() => void) | null {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(["Structure", "ExplorerTroops", "TileOccupancy"]);
  const navigate = useNavigateToMapView();
  const { isMapView } = useQuery();
  const army = storyRelicArmy(event, store);
  const position = resolveStoryEventPosition(event, store);
  if (army !== null && isMapView) return () => requestArmySelection(army);
  if (army !== null)
    return () => navigate(Position.fromContract(entityMapPosition(store, configManager.getActiveGameId(), army)));
  return position ? () => navigate(position) : null;
}

export const StoryFeedRow = ({ event }: { event: ProcessedStoryEvent }) => {
  const open = useStoryOpener(event);
  const battle = event.story === "BattleEvent";
  return (
    <button
      type="button"
      disabled={!open}
      onClick={() => open?.()}
      title={open ? event.presentation.description : "This event’s location is no longer available"}
      className="block w-full px-3 py-2 text-left !font-sans !text-[11px] normal-case tracking-normal text-gold enabled:hover:bg-gold/10 disabled:cursor-default"
    >
      {battle ? (
        <BattleDetails description={event.presentation.description} />
      ) : (
        <>
          <span className="flex justify-between gap-2 font-normal">
            <span className="truncate">{event.presentation.title}</span>
            <span className="shrink-0 tabular-nums text-gold/50">{formatFeedTime(event.timestampMs)}</span>
          </span>
          <span className="line-clamp-2 text-gold/65">{event.presentation.description}</span>
        </>
      )}
    </button>
  );
};

function BattleDetails({ description }: { description?: string }) {
  const segments = parsePresentationDescription(description);
  const attacker = extractRoleLabel(description, "Attacker");
  const defender = extractRoleLabel(description, "Defender");
  const forces = (role: string) =>
    normalizePresentationTroops(findSegmentValue(segments, (label) => label === `${role} forces`));
  const winner = formatWinnerName(findSegmentValue(segments, (label) => label === "Winner"));
  const rolls = battleRollsOf(description);
  return (
    <>
      <span className="flex gap-1 font-normal">
        <span aria-hidden>⚔</span>
        <span className="truncate">
          {attacker} <span className="text-gold/50">vs</span> {defender}
        </span>
      </span>
      <span className="mt-1 block text-gold/70">
        {forces("Attacker")} vs {forces("Defender")}
      </span>
      {rolls && (
        <span className="block text-gold/60">
          d20 {rolls.attacker} <span className="text-gold/40">vs</span> {rolls.defender}
        </span>
      )}
      {winner && <span className="block text-emerald-300">Winner: {winner}</span>}
    </>
  );
}
