import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type ButtonHTMLAttributes, type ReactNode, useId } from "react";

import { paintingSources, type Painting } from "./paintings";

/**
 * The app's elements: every page outside a game, each built only from the app scope of the token file (src/tokens.ts:
 * APP_TYPE, APP_SHEET) by its classes (app-sheet.css). A page takes these and gives them words and values, never a look
 * of its own. /lab/kit/app shows each in every state, beside what the app draws today. They render under
 * `data-surface="shell"`, where the `--app-*` values live.
 *
 * They draw no glyph (owner, 18 October 2026: the glyphs "just dont work" in the app): a word says what each thing is.
 */

type Tone = "good" | "bad" | "warn";
type Age = "blitz" | "frontier" | "eternum";

/** A button: primary is a page's one verb, secondary sits beside it, quiet is a way out. */
export const AppButton = ({
  kind,
  size = "md",
  keyHint,
  busy,
  tone,
  children,
  disabled,
  ...rest
}: {
  kind: "primary" | "secondary" | "quiet";
  /** lg: the page's one verb at the size it leads with (Play's Resume, the lobby's Pay and join). */
  size?: "md" | "lg";
  /** The key that presses it on a desktop (Enter on a page's one verb). */
  keyHint?: string;
  /** Its step is on its way: this word in place of its own, and no second press. */
  busy?: string;
  /** A secondary or quiet button that loses something (Sign out, Remove a device). */
  tone?: "bad";
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    {...rest}
    disabled={disabled || busy !== undefined}
    aria-busy={busy !== undefined || undefined}
    className="app-button"
    data-kind={kind}
    data-size={size}
    data-tone={kind === "primary" ? undefined : tone}
  >
    <span>{busy ?? children}</span>
    {keyHint && busy === undefined && <AppKey>{keyHint}</AppKey>}
  </button>
);

/** A key that presses something on a desktop: Enter on a page's one verb, Esc on Back. */
export const AppKey = ({ children }: { children: ReactNode }) => (
  <kbd aria-hidden className="app-key">
    {children}
  </kbd>
);

/** A field: its label above, its value, a line under it that helps or, in the bad tone, says what is wrong. */
export const AppField = ({
  label,
  hint,
  error,
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) => {
  const id = useId();
  return (
    <label className="app-field" htmlFor={id} data-invalid={error !== undefined || undefined}>
      <span className="app-field__label">{label}</span>
      <span className="app-field__box">
        <input id={id} {...rest} aria-invalid={error !== undefined || undefined} />
      </span>
      {(error ?? hint) && <span className="app-field__line">{error ?? hint}</span>}
    </label>
  );
};

/** The app's places: Play and Season in the bar, You behind the player at its end. */
export type AppPlace = "play" | "season" | "you";

const BAR_PLACES = [
  { key: "play", label: "Play" },
  { key: "season", label: "Season" },
] as const;

/**
 * The bar across the top of every page: the app's mark, its places with the current one in the accent, and the player
 * at its right end, who opens You.
 */
export const AppTopBar = ({
  current,
  player,
  onGo,
}: {
  current: AppPlace;
  player: { name: string; portrait?: string };
  onGo?: (place: AppPlace) => void;
}) => (
  <header className="app-bar">
    <img src="/images/logos/realms-lockup.svg" alt="Realms" className="app-bar__mark" />
    <nav className="app-bar__places" aria-label="Places">
      {BAR_PLACES.map((place) => (
        <button
          key={place.key}
          type="button"
          className="app-bar__place"
          aria-current={place.key === current ? "page" : undefined}
          onClick={() => onGo?.(place.key)}
        >
          {place.label}
        </button>
      ))}
    </nav>
    <button
      type="button"
      className="app-bar__place app-bar__player"
      aria-label={`You: ${player.name}`}
      aria-current={current === "you" ? "page" : undefined}
      onClick={() => onGo?.("you")}
    >
      {player.name}
      <AppPortrait src={player.portrait} name={player.name} size="sm" own />
    </button>
  </header>
);

/** A page under the app's bar: its content, no wider than a page runs on a desktop. */
export const AppFrame = ({
  current,
  player,
  onGo,
  children,
}: {
  current: AppPlace;
  player: { name: string; portrait?: string };
  onGo?: (place: AppPlace) => void;
  children: ReactNode;
}) => (
  <div className="app-frame">
    <AppTopBar current={current} player={player} onGo={onGo} />
    <main className="app-frame__page">{children}</main>
  </div>
);

/** A switch between views of one thing (Blitz | Eternum, Off | Important | All); the chosen one raised. */
export const AppTabs = <K extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly { key: K; label: string; dot?: boolean }[];
  value: K;
  onChange?: (key: K) => void;
  label: string;
}) => (
  <div className="app-tabs" role="tablist" aria-label={label}>
    {tabs.map((tab) => (
      <button
        key={tab.key}
        type="button"
        role="tab"
        aria-selected={tab.key === value}
        className="app-tabs__tab"
        onClick={() => onChange?.(tab.key)}
      >
        {tab.label}
        {tab.dot && <i className="app-tabs__dot" aria-label="Something of yours" />}
      </button>
    ))}
  </div>
);

/**
 * The app's one panel: its name (a cue at its end) over a rule, then its body. `flush` lets a list
 * run to its edges. `className` places it, never its look.
 */
export const AppPanel = ({
  title,
  cue,
  flush = false,
  className,
  children,
}: {
  title?: ReactNode;
  cue?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <section className={cn("app-panel", className)} data-flush={flush || undefined}>
    {title !== undefined && (
      <header className="app-panel__head">
        <h2>{title}</h2>
        {cue !== undefined && <span className="app-panel__cue">{cue}</span>}
      </header>
    )}
    <div className="app-panel__body">{children}</div>
  </section>
);

/**
 * A game, on its age's painting and in its age's accent: its title, what stands (facts), and its one verb. `lead` is
 * Play's first card, the one gold verb of the page; `tile` sits among others.
 */
export const AppGameCard = ({
  age,
  painting,
  eyebrow,
  title,
  facts,
  verb,
  size = "tile",
  className,
}: {
  age: Age;
  painting: Painting;
  eyebrow?: ReactNode;
  title: ReactNode;
  facts?: ReactNode;
  verb?: ReactNode;
  size?: "lead" | "tile";
  /** Places it (its height in a column), never its look. */
  className?: string;
}) => (
  <article className={cn("app-game-card", className)} data-age={age} data-size={size}>
    <img className="app-game-card__painting" alt="" {...paintingSources(painting)} sizes="50vw" />
    <div className="app-game-card__body">
      {eyebrow && <span className="app-game-card__eyebrow">{eyebrow}</span>}
      <h3 className="app-game-card__title">{title}</h3>
      {facts && <div className="app-game-card__facts">{facts}</div>}
      {verb && <div className="app-game-card__verb">{verb}</div>}
    </div>
  </article>
);

/**
 * One thing of a list: what leads it (a rank, a portrait), what it is and what it says, then what follows
 * (figures, its own button). The player's own row is lit. With `onClick` the row's words are the button that opens it.
 */
export const AppRow = ({
  lead,
  title,
  detail,
  trail,
  own = false,
  onClick,
}: {
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trail?: ReactNode;
  own?: boolean;
  onClick?: () => void;
}) => {
  const words = (
    <>
      <span className="app-row__title">{title}</span>
      {detail !== undefined && <span className="app-row__detail">{detail}</span>}
    </>
  );
  return (
    <div className="app-row" data-own={own || undefined}>
      {lead !== undefined && <span className="app-row__lead">{lead}</span>}
      {onClick ? (
        <button type="button" className="app-row__words" onClick={onClick}>
          {words}
        </button>
      ) : (
        <span className="app-row__words">{words}</span>
      )}
      {trail !== undefined && <span className="app-row__trail">{trail}</span>}
    </div>
  );
};

/** A rank at the head of a board's row; the top three in gold. */
export const AppRank = ({ rank }: { rank: number }) => (
  <span className="app-rank" data-top={rank <= 3 || undefined}>
    {rank}
  </span>
);

/** A small tag: a state (Live, Joined) in its tone, a count, an amount with its unit. */
export const AppChip = ({
  tone,
  live = false,
  children,
}: {
  tone?: Tone | "gold";
  /** A game under way: a dot that breathes before the word. */
  live?: boolean;
  children: ReactNode;
}) => (
  <span className="app-chip" data-tone={tone}>
    {live && <i className="app-chip__live" aria-hidden />}
    {children}
  </span>
);

/** A figure that is the point of its panel (the countdown, a rank, the seats taken), with what it counts under it. */
export const AppFigure = ({ value, label, tone }: { value: ReactNode; label?: ReactNode; tone?: Tone | "gold" }) => (
  <span className="app-figure" data-tone={tone}>
    <span className="app-figure__value">{value}</span>
    {label !== undefined && <span className="app-figure__label">{label}</span>}
  </span>
);

/** Something the page must say: its line, why, and Try again where trying again can help. */
export const AppNotice = ({
  tone,
  line,
  why,
  retry,
}: {
  tone?: Tone;
  line: string;
  why?: string;
  retry?: () => void;
}) => (
  <div className="app-notice" data-tone={tone} role={tone === "bad" ? "alert" : "status"}>
    <span className="app-notice__words">
      <span>{line}</span>
      {why && <span className="app-notice__why">{why}</span>}
    </span>
    {retry && (
      <AppButton kind="secondary" onClick={retry}>
        Try again
      </AppButton>
    )}
  </div>
);

/** On or off, named. */
export const AppSwitch = ({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className="app-switch"
    onClick={() => onChange?.(!checked)}
  >
    <i />
  </button>
);

/** A setting: its name and what it holds now, then its control (a switch), or the whole row opens it. */
export const AppSetting = ({
  name,
  value,
  control,
  onClick,
}: {
  name: string;
  value?: ReactNode;
  control?: ReactNode;
  onClick?: () => void;
}) => (
  <AppRow
    title={name}
    trail={
      <>
        {value !== undefined && <span className="app-setting__value">{value}</span>}
        {control}
      </>
    }
    onClick={onClick}
  />
);

/** A choice among a few, drawn as tiles (the entry's seat, sword and shield): its name, what it does, its price. */
export const AppChoice = ({
  title,
  detail,
  price,
  selected = false,
  disabled,
  onClick,
}: {
  title: string;
  detail?: ReactNode;
  price?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) => (
  <button type="button" className="app-choice" aria-pressed={selected} disabled={disabled} onClick={onClick}>
    <span className="app-choice__title">{title}</span>
    {detail !== undefined && <span className="app-choice__detail">{detail}</span>}
    {price !== undefined && <span className="app-choice__price">{price}</span>}
  </button>
);

/** A player's portrait in its ring; the player's own ring in the accent. An initial where there is no portrait. */
export const AppPortrait = ({
  src,
  name,
  size = "md",
  own = false,
}: {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  own?: boolean;
}) => (
  <span className="app-portrait" data-size={size} data-own={own || undefined} title={name}>
    {src ? <img src={src} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
  </span>
);

/** A page's head: Back to where it came from (with Esc on a desktop), its title, and what it does at its end. */
export const AppPageHead = ({ title, back, aside }: { title: ReactNode; back?: () => void; aside?: ReactNode }) => (
  <header className="app-page-head">
    {back && (
      <button type="button" className="app-page-head__back" onClick={back}>
        Back
        <AppKey>Esc</AppKey>
      </button>
    )}
    <h1>{title}</h1>
    {aside !== undefined && <span className="app-page-head__aside">{aside}</span>}
  </header>
);

/** Nothing here yet, said once, with the one step that would fill it. */
export const AppEmpty = ({ line, action }: { line: string; action?: ReactNode }) => (
  <div className="app-empty">
    <span>{line}</span>
    {action}
  </div>
);

/** Rows standing in for a list that is coming. */
export const AppSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <span className="app-skeleton" aria-hidden>
    {Array.from({ length: rows }, (_, index) => (
      <i key={index} style={{ width: `${92 - index * 14}%` }} />
    ))}
  </span>
);

/** A question before something that cannot be undone: its title, what it costs, and its way out and its verb. */
export const AppDialog = ({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions: ReactNode;
}) => (
  <section role="dialog" aria-label={title} className="app-dialog">
    <h2>{title}</h2>
    {children && <div className="app-dialog__body">{children}</div>}
    <footer className="app-dialog__foot">{actions}</footer>
  </section>
);
