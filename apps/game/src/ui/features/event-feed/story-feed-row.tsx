import {
  extractRoleLabel,
  findSegmentValue,
  normalizePresentationTroops,
  parsePresentationDescription,
} from "@/ui/features/story-events/story-event-utils";
import { linkFrom, openOnMap } from "@/play/navigation/open-place";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { Position, configManager, structureMapPosition, entityMapPosition } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { formatClockTime } from "@bibliothecadao/types";
import { HudEventRow, HudRanked } from "@/ui/design-system/kit/hud-elements";
import { storyMeaning } from "@/ui/design-system/domain-icon-meaning";
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

export function useStoryOpener(event: ProcessedStoryEvent): (() => void) | null {
  const {
    setup: { store },
  } = useGame();
  useNativeRevision(["Structure", "ExplorerTroops", "TileOccupancy"]);
  const position = resolveStoryEventPosition(event, store);
  return position ? linkFrom(event.timestampMs / 1000, () => openOnMap(position, "tile")) : null;
}

/** A world story in the Log: what happened and its line (a fight's sides, forces and rolls), and its time. */
export const StoryFeedRow = ({ event }: { event: ProcessedStoryEvent }) => {
  const open = useStoryOpener(event);
  // The row's second line and its tip are the same words, ranks and all: the tip says them whole where the line is cut.
  const description = event.presentation.ranked?.description ?? event.presentation.description;
  return (
    <HudEventRow
      time={formatClockTime(event.timestampMs / 1000)}
      icon={storyMeaning(event.story)}
      tip={open ? description : "This event’s location is no longer available"}
      onOpen={open ?? undefined}
    >
      {event.story === "BattleEvent" ? (
        <BattleDetails description={event.presentation.description} />
      ) : (
        <span className="flex flex-col">
          <span className="truncate">
            <HudRanked words={event.presentation.ranked?.title ?? event.presentation.title} />
          </span>
          <span className="line-clamp-2 text-hud-label text-hud-muted">
            <HudRanked words={description ?? ""} />
          </span>
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
  return (
    <span className="flex flex-col">
      <span className="truncate">
        {attacker} <span className="text-hud-muted">vs</span> {defender}
      </span>
      <span className="text-hud-label text-hud-muted">
        {forces("Attacker")} vs {forces("Defender")}
      </span>
      {outcome && <span className="text-hud-label text-hud-good">{outcome}</span>}
    </span>
  );
}
