import {
  AppButton,
  AppChip,
  AppChoice,
  AppFigure,
  AppField,
  AppGameCard,
  AppNav,
  AppPortrait,
  AppRank,
  AppRow,
  type AppPlace,
} from "@/ui/design-system/kit/app-elements";
import { Icon } from "@/ui/design-system/icon";
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
 * The app's page parts, each built only from the app sheet's elements: the directions lay them out differently, so a
 * direction compares layouts, never looks.
 */

export const PLACES: readonly AppPlace[] = [
  { key: "play", label: "Play", icon: "play", keyHint: "1" },
  { key: "season", label: "Season", icon: "victory", keyHint: "2" },
  { key: "you", label: "You", icon: "person", keyHint: "3" },
];

/** The app's mark: the Realms lockup. */
const Lockup = () => <img src="/images/logos/realms-lockup.svg" alt="Realms" className="h-7 w-auto" />;

/** The places across the top, the player at the end. */
export const TopBar = ({ current }: { current: string }) => (
  <header className="flex h-[72px] flex-none items-center gap-8 border-b border-app-line bg-app-ground px-12">
    <Lockup />
    <AppNav places={PLACES} current={current} />
    <span className="ml-auto flex items-center gap-3 text-app-label text-app-muted">
      <span className="text-app-strong text-app-ink">{PLAYER.name}</span>
      #12 · Frontier
      <AppPortrait src={PLAYER.portrait} name={PLAYER.name} size="sm" own />
    </span>
  </header>
);

/** The places down the side, the player at its foot. */
export const SideRail = ({ current }: { current: string }) => (
  <aside className="flex w-[280px] flex-none flex-col gap-8 border-r border-app-line bg-app-ground px-5 py-7">
    <span className="px-3">
      <Lockup />
    </span>
    <AppNav
      places={[...PLACES, { key: "news", label: "What's new", icon: "chronicles" }]}
      current={current}
      orientation="rail"
    />
    <div className="mt-auto flex items-center gap-3 rounded-[var(--app-radius-panel)] border border-app-line bg-app-surface p-3">
      <AppPortrait src={PLAYER.portrait} name={PLAYER.name} own />
      <span className="flex flex-col">
        <span className="text-app-strong text-app-ink">{PLAYER.name}</span>
        <span className="text-app-label text-app-muted">#12 of 1,240 · Frontier</span>
      </span>
    </div>
  </aside>
);

/** A painting behind a page, faded into the ground. */
export const Backdrop = ({ age, strength = "soft" }: { age: LabAge; strength?: "soft" | "full" }) => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    <img
      alt=""
      {...paintingSources(AGE_OF[age].painting)}
      sizes="100vw"
      className={strength === "full" ? "h-full w-full object-cover" : "h-full w-full object-cover opacity-35"}
    />
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
export const LeadCard = ({ size = "lead", className }: { size?: "lead" | "tile"; className?: string }) => {
  const lead = GAMES.find((game) => game.lead)!;
  return (
    <AppGameCard
      age={lead.age}
      painting={AGE_OF[lead.age].painting}
      size={size}
      className={className}
      eyebrow={`Age ${AGE_OF[lead.age].numeral} · Now`}
      title={lead.title}
      facts={
        <>
          {gameState(lead)}
          <AppChip icon="hourglass">Day 12 · 7h 14m left</AppChip>
          <AppChip>Tomorrow lasts 24h</AppChip>
        </>
      }
      verb={
        <AppButton kind="primary" size="lg" icon="play" keyHint="Enter">
          {lead.verb}
        </AppButton>
      }
    />
  );
};

/** One game as a row: its age's painting, its name and line, its state, its verb. */
export const GameRow = ({ game }: { game: LabGame }) => (
  <AppRow
    lead={
      <img
        alt=""
        src={paintingSources(AGE_OF[game.age].painting).src}
        className="size-12 rounded-[var(--app-radius-control)] object-cover"
      />
    }
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

/** The games of one age, or of all, but the lead. */
export const gamesOf = (age?: LabAge) => GAMES.filter((game) => !game.lead && (age === undefined || game.age === age));

/** Frontier's season board: rank, player, sites cleared, LORDS; the player's own lit. */
export const FrontierBoard = ({ rows = FRONTIER_BOARD.length }: { rows?: number }) => (
  <div>
    {FRONTIER_BOARD.slice(0, rows).map((row) => (
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
            <AppPortrait name={row.name} size="sm" own={"own" in row} />
          </>
        }
        title={"own" in row ? `${row.name} · You` : row.name}
        trail={
          <>
            <span>{row.rating}</span>
            <AppChip icon="lords" tone="gold">
              {row.prize}
            </AppChip>
          </>
        }
      />
    ))}
  </div>
);

/** Where the player stands this season, in three figures. */
export const Standing = ({ layout = "row" }: { layout?: "row" | "column" }) => (
  <div className={layout === "row" ? "flex gap-12" : "flex flex-col gap-6"}>
    <AppFigure value="#12" label="Frontier · of 1,240" tone="gold" />
    <AppFigure value="1,744" label="Blitz rating · Conqueror" />
    <AppFigure value="6,878" label="LORDS if the season ended now" tone="gold" />
  </div>
);

/** Who is in the Blitz: the seats of a launched game, the player's own ringed, the empty ones waiting. */
export const Seats = ({ columns = 6 }: { columns?: number }) => (
  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
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

/** The lobby's clock: when entry closes. */
export const LobbyClock = () => <AppFigure value="2:03:57" label="Entry closes in" />;

/** The paid entry: the seat, the sword and the shield, what it costs, and Pay and join. */
export const Entry = ({ verbSize = "lg" }: { verbSize?: "md" | "lg" }) => (
  <div className="flex flex-col gap-4">
    <div className="flex gap-3">
      <AppChoice icon="flag" title="Seat" detail="Entry" price="500 LORDS" selected />
      <AppChoice icon="attack" title="Sword" detail="Win ×2" price="+ 50 LORDS" />
      <AppChoice icon="defend" title="Shield" detail="Lose ½" price="+ 50 LORDS" />
    </div>
    <div className="flex flex-col rounded-[var(--app-radius-control)] border border-app-line">
      <AppRow title="Seat" trail={<span>500</span>} />
      <AppRow
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
    <AppButton kind="primary" size={verbSize} icon="play" keyHint="Enter">
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
export const Outcome = ({ align = "start" }: { align?: "start" | "center" }) => (
  <div className={align === "center" ? "flex flex-col items-center gap-4 text-center" : "flex flex-col gap-4"}>
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
  <div className="flex flex-col items-center gap-3 text-center">
    <Icon name="chest" size={96} />
    <span className="text-app-heading text-app-ink">A sealed chest</span>
    <span className="text-app-label text-app-muted">Epic or better · opens once</span>
    <AppButton kind="primary" icon="chest" keyHint="Enter">
      Open
    </AppButton>
  </div>
);
