import {
  extractRoleLabel,
  findSegmentValue,
  formatWinnerName,
  normalizePresentationTroops,
  parsePresentationDescription,
} from "@/ui/features/story-events/story-event-utils";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { gameEntityKey } from "@bibliothecadao/eternum/game-client";
import { Position } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import type { ClientComponents } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { formatFeedTime } from "./important-feed-rows";

export function resolveStoryEventPosition(event: ProcessedStoryEvent, components: ClientComponents): Position | null {
  const coord = event.storyPayload.end_coord ?? event.storyPayload.coord;
  if (coord && typeof coord === "object" && "x" in coord && "y" in coord) {
    return new Position({ x: Number(coord.x), y: Number(coord.y) });
  }
  // Battle stories contain participant IDs but no historical hex. Resolve surviving entities from RECS.
  for (const id of [event.storyPayload.defender_id, event.entity_id, event.storyPayload.attacker_id]) {
    if (id == null) continue;
    const key = gameEntityKey([BigInt(String(id))]);
    const structure = getComponentValue(components.Structure, key);
    if (structure) return new Position({ x: structure.base.coord_x, y: structure.base.coord_y });
    const army = getComponentValue(components.ExplorerTroops, key);
    if (army) return new Position({ x: army.coord.x, y: army.coord.y });
  }
  return null;
}

export const StoryFeedRow = ({ event }: { event: ProcessedStoryEvent }) => {
  const {
    setup: { components },
  } = useDojo();
  const navigate = useNavigateToMapView();
  const position = resolveStoryEventPosition(event, components);
  const battle = event.story === "BattleStory";
  return (
    <button
      type="button"
      disabled={!position}
      onClick={() => position && navigate(position)}
      title={position ? event.presentation.description : "This event’s location is no longer available"}
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
      {winner && <span className="block text-emerald-300">Winner: {winner}</span>}
    </>
  );
}
