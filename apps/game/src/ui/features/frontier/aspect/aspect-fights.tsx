import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { type ProcessedStoryEvent, useStoryReads } from "@/hooks/store/use-story-events-store";
import { ASPECT_PAGE_WORDS } from "@/ui/design-system/kit/words";
import { FeedRowLine } from "@/ui/features/event-feed/feed-row-line";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { type AspectId, aspectName } from "@bibliothecadao/types";

/** How many battle stories the page reads, newest first, and how many fights of the Aspect it shows. */
const BATTLES_READ = 100;
const FIGHTS_SHOWN = 12;
const BATTLE_READS = [{ limit: BATTLES_READ, story: "BattleEvent" }];

/** A fight between players that a member of the Aspect took part in, and the Aspect it was fought against. */
type AspectFight = { event: ProcessedStoryEvent; against: AspectId };

/**
 * The Aspect's fights, newest first: battle stories between two players (in Season 1 only the Deep pits armies against
 * armies) in which one side plays for `aspect`, each with the Aspect of the other side. A story naming no player of
 * the Aspect, or two players of it, is not one of its fights.
 */
export const selectAspectFights = (
  stories: readonly ProcessedStoryEvent[],
  aspectOf: ReadonlyMap<string, AspectId>,
  aspect: AspectId,
): AspectFight[] =>
  stories
    .filter((event) => event.story === "BattleEvent" && event.participants.length === 2)
    .flatMap((event) => {
      const sides = event.participants.map((player) => aspectOf.get(player));
      const ours = sides.filter((side) => side === aspect).length;
      const against = sides.find((side) => side !== undefined && side !== aspect);
      return ours === 1 && against !== undefined ? [{ event, against }] : [];
    })
    .toSorted((left, right) => right.event.timestampMs - left.event.timestampMs)
    .slice(0, FIGHTS_SHOWN);

/** Each player's Aspect, by the address a story names them with: the owner of a home that joined one (HomeAspect). */
const aspectsByPlayer = (store: NativeFactStore, gameId: number): Map<string, AspectId> => {
  const players = new Map<string, AspectId>();
  for (const { home, aspect } of store.inGame("HomeAspect", gameId)) {
    const owner = store.get("Structure", { game_id: gameId, entity_id: home })?.owner;
    if (owner) players.set(`0x${BigInt(owner).toString(16)}`, aspect as AspectId);
  }
  return players;
};

/** The Aspect page's fights: who was wiped and by which Aspect, each told by the Feed's own story row. */
export const AspectFights = ({ aspect }: { aspect: AspectId }) => {
  const { setup } = useGame();
  useNativeRevision(["HomeAspect", "Structure"]);
  const { data } = useStoryReads(BATTLE_READS);
  const fights = selectAspectFights(data, aspectsByPlayer(setup.store, configManager.getActiveGameId()), aspect);
  return (
    <section data-aspect-fights className="flex flex-col gap-1">
      <span className="text-hud-strong text-hud-ink">{ASPECT_PAGE_WORDS.fights}</span>
      {fights.length === 0 && <span className="text-hud-label text-hud-muted">{ASPECT_PAGE_WORDS.noFights}</span>}
      {fights.map(({ event, against }) => (
        <div key={event.id} className="flex flex-col">
          <FeedRowLine event={event} />
          <span className="pl-8 text-hud-label text-hud-muted">{ASPECT_PAGE_WORDS.against(aspectName(against))}</span>
        </div>
      ))}
    </section>
  );
};
