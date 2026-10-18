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
import { paintingSources } from "@/ui/design-system/kit/paintings";

import {
  AGE_OF,
  BLITZ_BOARD,
  CHAT,
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
          <AppChip>Day 12 · 7h 14m left</AppChip>
          <AppChip>Tomorrow lasts 24h</AppChip>
        </>
      }
      verb={
        <AppButton kind="primary" size="lg" keyHint="Enter">
          {lead.verb}
        </AppButton>
      }
    />
  );
};

/** One game as a row under its age: its name and line, its state, its verb. */
export const GameRow = ({ game }: { game: LabGame }) => (
  <AppRow
    title={game.title}
    detail={game.line}
    trail={
      <>
        {gameState(game)}
        <AppButton kind="secondary">{game.verb}</AppButton>
      </>
    }
  />
);

/** The games of one age, but the lead. */
export const gamesOf = (age: LabAge) => GAMES.filter((game) => !game.lead && game.age === age);

/** Frontier's season board: rank, player, sites cleared, LORDS; the player's own lit. */
export const FrontierBoard = () => (
  <div>
    {FRONTIER_BOARD.map((row) => (
      <AppRow
        key={row.rank}
        own={"own" in row}
        lead={
          <>
            <AppRank rank={row.rank} />
            <AppPortrait
              src={`/images/avatars/${String((row.rank % 12) + 1).padStart(2, "0")}.png`}
              name={row.name}
              size="sm"
              own={"own" in row}
            />
          </>
        }
        title={"own" in row ? `${row.name} · You` : row.name}
        trail={
          <>
            <span className="text-app-muted">{row.sites} sites</span>
            <AppChip tone="gold">{row.lords} LORDS</AppChip>
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
            <AppPortrait name={row.name} size="sm" own={"own" in row} />
          </>
        }
        title={"own" in row ? `${row.name} · You` : row.name}
        trail={
          <>
            <span>{row.rating}</span>
            <AppChip tone="gold">{row.prize} LORDS</AppChip>
          </>
        }
      />
    ))}
  </div>
);

/** Where the player stands this season, in three figures. */
export const Standing = () => (
  <div className="flex gap-12">
    <AppFigure value="#12" label="Frontier · of 1,240" tone="gold" />
    <AppFigure value="1,744" label="Blitz rating · Conqueror" />
    <AppFigure value="6,878" label="LORDS if the season ended now" tone="gold" />
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
      <AppChoice title="Seat" detail="Entry" price="500 LORDS" selected />
      <AppChoice title="Sword" detail="Win ×2" price="+ 50 LORDS" />
      <AppChoice title="Shield" detail="Lose ½" price="+ 50 LORDS" />
    </div>
    <div className="flex flex-col rounded-[var(--app-radius-control)] border border-app-line">
      <AppRow title="Seat" trail={<span>500</span>} />
      <AppRow title="Total" detail="Held 2,140 LORDS" trail={<AppChip tone="gold">500 LORDS</AppChip>} own />
    </div>
    <AppButton kind="primary" keyHint="Enter">
      Pay and join
    </AppButton>
  </div>
);

/** The registered count of a slot not yet drawn. */
export const Registered = () => (
  <div className="flex items-center gap-6">
    <AppFigure value="31" label="registered" tone="gold" />
    <p className="max-w-[22rem] text-app-body text-app-muted">No cap. Games of up to 24 are drawn when entry closes.</p>
  </div>
);

/** The lobby's chat: the room's lines, then the player's field. */
export const Chat = () => (
  <div className="flex flex-col gap-3">
    <ul className="flex flex-col gap-1.5">
      {CHAT.map((line) => (
        <li key={line.who} className="text-app-body text-app-ink">
          <span className="text-app-strong text-[rgb(var(--app-accent))]">{line.who}</span> {line.line}
        </li>
      ))}
    </ul>
    <AppField label="Say something" placeholder="Message the lobby" />
  </div>
);

/** A Blitz's outcome for the player: the place, the points, the rating change. */
export const Outcome = () => (
  <div className="flex flex-col gap-4">
    <span className="text-app-label text-[rgb(var(--app-age))]">Blitz 11:00 · Ended today</span>
    <span className="text-app-display text-app-ink">3rd of 24</span>
    <div className="flex gap-10">
      <AppFigure value="352" label="points" tone="gold" />
      <AppFigure value="+36" label="rating · 1,744 → 1,780" tone="good" />
    </div>
  </div>
);

/** How the points were made. */
export const Breakdown = () => (
  <div>
    {RESULT_BREAKDOWN.map((row) => (
      <AppRow
        key={row.what}
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
            <AppPortrait name={row.name} size="sm" own={"own" in row} />
          </>
        }
        title={"own" in row ? `${row.name} · You` : row.name}
        trail={<span>{row.points} pts</span>}
        onClick={() => undefined}
      />
    ))}
  </div>
);

/** The chest the game paid: sealed, with Open as the page's one gold step. */
export const Chest = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
    <span className="text-app-title text-app-ink">Sealed</span>
    <span className="text-app-label text-app-muted">Epic or better · opens once</span>
    <AppButton kind="primary" size="lg" keyHint="Enter">
      Open
    </AppButton>
  </div>
);
