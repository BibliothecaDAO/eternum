import {
  AppButton,
  AppChip,
  AppChoice,
  AppFigure,
  AppField,
  AppGameCard,
  AppPortrait,
  AppRank,
  AppRow,
} from "@/ui/design-system/kit/app-elements";
import { Icon } from "@/ui/design-system/icon";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { REWARD_WORDS } from "@/ui/design-system/kit/words";

import {
  AGE_OF,
  BLITZ_BOARD,
  CHAT,
  CHEST,
  FRONTIER_BOARD,
  GAMES,
  type LabAge,
  type LabGame,
  PLAYER,
  RESULT_BOARD,
  RESULT_BREAKDOWN,
  SEATS,
} from "./app-lab-data";

/**
 * The app's page parts, each built only from the app sheet's elements, for the pages the lab lays out (app-pages.tsx).
 */

/** An age's painting behind what shows it, faded into the ground at its foot. */
export const Backdrop = ({ age }: { age: LabAge }) => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <img alt="" {...paintingSources(AGE_OF[age].painting)} sizes="33vw" className="h-full w-full object-cover" />
    <div className="absolute inset-0 bg-[linear-gradient(0deg,var(--app-ground)_0%,transparent_60%)]" />
  </div>
);

/** A player's portrait on a board: the avatars the fixtures hand out by rank; a wallet address has none. */
const portraitOf = (name: string, rank: number) =>
  name.startsWith("0x") ? undefined : `/images/avatars/${String((rank % 12) + 1).padStart(2, "0")}.png`;

const gameState = (game: LabGame) =>
  game.state && (
    <AppChip tone={game.state.tone} live={game.state.live}>
      {game.state.word}
    </AppChip>
  );

/** Play's lead: the one game to act on now, on its painting, with the page's one gold verb. */
export const LeadCard = ({ className }: { className?: string }) => {
  const lead = GAMES.find((game) => game.lead)!;
  return (
    <AppGameCard
      age={lead.age}
      painting={AGE_OF[lead.age].painting}
      size="lead"
      className={className}
      eyebrow={`Age ${AGE_OF[lead.age].numeral} · Now`}
      title={lead.title}
      facts={
        <>
          {gameState(lead)}
          <AppChip icon="hourglass">Day 12 · 7h 14m left</AppChip>
          <AppChip icon="sun">Tomorrow lasts 24h</AppChip>
        </>
      }
      verb={
        <AppButton kind="primary" size="lg" icon={lead.icon} keyHint="Enter">
          {lead.verb}
        </AppButton>
      }
    />
  );
};

/** One game as a row under its age: its name and line, its state, its verb with its icon. */
export const GameRow = ({ game }: { game: LabGame }) => (
  <AppRow
    title={game.title}
    detail={game.line}
    trail={
      <>
        {gameState(game)}
        <AppButton kind="secondary" icon={game.icon}>
          {game.verb}
        </AppButton>
      </>
    }
  />
);

/** The games of one age, but the lead. */
export const gamesOf = (age: LabAge) => GAMES.filter((game) => !game.lead && game.age === age);

/** Frontier's season board: the top nine and the player's own row, lit; rank, player, sites cleared, LORDS. */
export const FrontierBoard = () => (
  <div>
    {FRONTIER_BOARD.filter((row) => row.rank <= 9 || "own" in row).map((row) => (
      <AppRow
        key={row.rank}
        own={"own" in row}
        lead={
          <>
            <AppRank rank={row.rank} />
            <AppPortrait
              src={"own" in row ? PLAYER.portrait : portraitOf(row.name, row.rank)}
              name={row.name}
              size="sm"
              own={"own" in row}
            />
          </>
        }
        title={"own" in row ? `${row.name} · You` : row.name}
        trail={
          <>
            <AppChip icon="explore">{row.sites}</AppChip>
            <AppChip icon="lords" tone="gold">
              {row.lords}
            </AppChip>
          </>
        }
        onClick={() => undefined}
      />
    ))}
  </div>
);

/** Blitz's rating board with the season prize each place would take now. */
export const BlitzBoard = () => (
  <div>
    {BLITZ_BOARD.map((row) => (
      <AppRow
        key={row.rank}
        own={"own" in row}
        lead={
          <>
            <AppRank rank={row.rank} />
            <AppPortrait
              src={"own" in row ? PLAYER.portrait : portraitOf(row.name, row.rank)}
              name={row.name}
              size="sm"
              own={"own" in row}
            />
          </>
        }
        title={"own" in row ? `${row.name} · You` : row.name}
        trail={
          <>
            <AppChip icon="rating-conqueror">{row.rating}</AppChip>
            <AppChip icon="lords" tone="gold">
              {row.prize}
            </AppChip>
          </>
        }
      />
    ))}
  </div>
);

/** Where the player stands this season, in three figures, each with its picture. */
export const Standing = () => (
  <div className="flex items-center gap-12">
    <AppPortrait src={PLAYER.portrait} name={PLAYER.name} size="lg" own />
    <AppFigure icon="leaderboard" value="#12" label="Frontier · of 1,240" tone="gold" />
    <AppFigure icon="rating-conqueror" value="1,744" label="Blitz rating · Conqueror" />
    <AppFigure icon="lords" value="6,878" label="LORDS if the season ended now" tone="gold" />
  </div>
);

/** Who is in the Blitz: the seats of a launched game, the player's own ringed, the empty ones waiting. */
export const Seats = () => (
  <div className="grid grid-cols-6 gap-3">
    {SEATS.map((seat, index) =>
      seat ? (
        <span key={index} className="flex flex-col items-center gap-1.5">
          <AppPortrait
            src={index === 6 ? PLAYER.portrait : seat.portrait}
            name={index === 6 ? PLAYER.name : seat.name}
            own={index === 6}
          />
          <span className="max-w-full truncate text-app-label text-app-muted">{index === 6 ? "You" : seat.name}</span>
        </span>
      ) : (
        <span key={index} className="flex flex-col items-center gap-1.5">
          <span className="size-11 rounded-full border-2 border-dashed border-app-line" />
          <span className="text-app-label text-app-muted">Open</span>
        </span>
      ),
    )}
  </div>
);

/** The paid entry: the seat, the sword and the shield, what it costs, and Pay and join. */
export const Entry = () => (
  <div className="flex flex-col gap-4">
    <div className="flex gap-3">
      <AppChoice icon="flag" title="Seat" detail="Entry" price="500 LORDS" selected />
      <AppChoice icon="attack" title="Sword" detail="Win ×2" price="+ 50 LORDS" />
      <AppChoice icon="defend" title="Shield" detail="Lose ½" price="+ 50 LORDS" />
    </div>
    <div className="flex flex-col rounded-[var(--app-radius-control)] border border-app-line">
      <AppRow lead={<Icon name="flag" size={24} />} title="Seat" trail={<span>500</span>} />
      <AppRow
        lead={<Icon name="lords" size={24} />}
        title="Total"
        detail="Held 2,140 LORDS"
        trail={
          <AppChip icon="lords" tone="gold">
            500
          </AppChip>
        }
        own
      />
    </div>
    <AppButton kind="primary" size="lg" icon="play" keyHint="Enter">
      Pay and join
    </AppButton>
  </div>
);

/** The registered count of a slot not yet drawn. */
export const Registered = () => (
  <div className="flex items-center gap-6">
    <AppFigure icon="people" value="31" label="registered" tone="gold" />
    <p className="max-w-[22rem] text-app-body text-app-muted">No cap. Games of up to 24 are drawn when entry closes.</p>
  </div>
);

/** The lobby's chat: the room's lines, each with its player's portrait, then the player's field. */
export const Chat = () => (
  <div className="flex flex-col gap-3">
    <ul className="flex flex-col gap-2">
      {CHAT.map((line, index) => (
        <li key={line.who} className="flex items-center gap-2 text-app-body text-app-ink">
          <AppPortrait src={portraitOf(line.who, index + 1)} name={line.who} size="sm" />
          <span>
            <span className="text-app-strong text-[rgb(var(--app-accent))]">{line.who}</span> {line.line}
          </span>
        </li>
      ))}
    </ul>
    <AppField label="Say something" icon="chat" placeholder="Message the lobby" />
  </div>
);

/** A Blitz's outcome for the player: the place, the points, the rating change. */
export const Outcome = () => (
  <div className="flex items-center gap-8">
    <AppPortrait src={PLAYER.portrait} name={PLAYER.name} size="lg" own />
    <div className="flex flex-col gap-4">
      <span className="text-app-label text-[rgb(var(--app-age))]">Blitz 11:00 · Ended today</span>
      <span className="text-app-display text-app-ink">3rd of 24</span>
      <div className="flex gap-10">
        <AppFigure icon="star" value="352" label="points" tone="gold" />
        <AppFigure icon="rating-conqueror" value="+36" label="rating · 1,744 → 1,780" tone="good" />
      </div>
    </div>
  </div>
);

/** How the points were made, each kind with its icon. */
export const Breakdown = () => (
  <div>
    {RESULT_BREAKDOWN.map((row) => (
      <AppRow
        key={row.what}
        lead={<Icon name={row.icon} size={28} />}
        title={row.what}
        detail={row.count ? `× ${row.count}` : undefined}
        trail={<span>{row.points} pts</span>}
      />
    ))}
  </div>
);

/** The game's board: its first rows, the player's own lit. */
export const ResultBoard = () => (
  <div>
    {RESULT_BOARD.map((row) => (
      <AppRow
        key={row.rank}
        own={"own" in row}
        lead={
          <>
            <AppRank rank={row.rank} />
            <AppPortrait
              src={"own" in row ? PLAYER.portrait : portraitOf(row.name, row.rank)}
              name={row.name}
              size="sm"
              own={"own" in row}
            />
          </>
        }
        title={"own" in row ? `${row.name} · You` : row.name}
        trail={<AppChip icon="star">{row.points}</AppChip>}
        onClick={() => undefined}
      />
    ))}
  </div>
);

/** A rank band's chest, sealed or opened: the reward chests' art (public/images/blitz-chests). */
export const chestArt = (band: number, opened: boolean) =>
  `/images/blitz-chests/band-${band}-${opened ? "opened" : "sealed"}.webp`;

/** The chest the game paid, drawn at its tier: sealed with Open as the page's one gold step, or opened with its prize. */
export const Chest = ({ opened }: { opened: boolean }) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
    <img src={chestArt(CHEST.band, opened)} alt="" className="size-56 object-contain drop-shadow-2xl" />
    <AppChip icon="victory">{REWARD_WORDS.band[CHEST.band]}</AppChip>
    {opened ? <ChestPrize /> : <SealedChest />}
  </div>
);

const SealedChest = () => (
  <>
    <AppChip icon="lords" tone="gold">
      {REWARD_WORDS.entryUntil(CHEST.shares, CHEST.until)}
    </AppChip>
    <AppButton kind="primary" size="lg" icon="chest" keyHint="Enter">
      {REWARD_WORDS.open}
    </AppButton>
  </>
);

const ChestPrize = () => (
  <>
    <AppFigure icon="lords" value={`${CHEST.shares}×`} label={REWARD_WORDS.theEntry} tone="gold" />
    <AppChip icon="lords" tone="gold">{`${CHEST.paid} ${REWARD_WORDS.lords}`}</AppChip>
    <AppChip icon="check" tone="good">
      {REWARD_WORDS.lordsSent}
    </AppChip>
  </>
);
