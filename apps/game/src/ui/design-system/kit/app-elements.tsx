import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react";
import { Link, type To, useNavigate } from "react-router-dom";

import { BACK } from "./words";

import { paintingSources, type Painting } from "./paintings";
import { useSheetCloses } from "./sheet-closes";

/**
 * The app's elements: every page outside a game, each built only from the app scope of the token file (src/tokens.ts:
 * APP_TYPE, APP_SHEET) by its classes (app-sheet.css). A page takes these and gives them words and values, never a look
 * of its own. /lab/kit/app shows each in every state, beside what the app draws today. They render under
 * `data-surface="shell"`, where the `--app-*` values live.
 *
 * Pictures carry the meaning with the words (owner, 18 October 2026: "have you ever seen a game with just words?"): a
 * place, a panel, a verb and a figure take their painted icon (`Icon`), a game its age's painting, and every page stands
 * on its painting under the frame.
 */

type Tone = "good" | "bad" | "warn";
type Age = "blitz" | "frontier" | "eternum";

type AppButtonProps = {
  kind: "primary" | "secondary" | "quiet";
  /** lg: the page's one verb at the size it leads with (Play's Resume, the lobby's Pay and join). */
  size?: "md" | "lg";
  icon?: IconMeaning;
  /** The screen's one step: Enter presses it on a desktop, and its key shows beside its word. */
  step?: boolean;
  /** Its step is on its way: this word in place of its own, and no second press. */
  busy?: string;
  /** A secondary or quiet button that loses something (Sign out, Remove a device), or a primary that still costs. */
  tone?: "bad";
  /** A verb that leads somewhere: the route it opens, after `onClick` has run. */
  to?: To;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** A button: primary is a page's one verb, secondary sits beside it, quiet is a way out. */
export const AppButton = ({ to, step = false, ...button }: AppButtonProps) => {
  const face =
    to === undefined ? <AppButtonFace {...button} step={step} /> : <RouteButton {...button} step={step} to={to} />;
  // The desktop's Enter presses the button under the screen's step mark (shell/frame/desktop-keys.ts).
  return step ? (
    <span data-role="step" className="contents">
      {face}
    </span>
  ) : (
    face
  );
};

const RouteButton = ({ to, onClick, ...button }: Omit<AppButtonProps, "to"> & { to: To }) => {
  const navigate = useNavigate();
  return (
    <AppButtonFace
      {...button}
      onClick={(event) => {
        onClick?.(event);
        navigate(to);
      }}
    />
  );
};

const AppButtonFace = ({
  kind,
  size = "md",
  icon,
  step,
  busy,
  tone,
  children,
  disabled,
  className,
  ...rest
}: Omit<AppButtonProps, "to">) => (
  <button
    type="button"
    {...rest}
    disabled={disabled || busy !== undefined}
    aria-busy={busy !== undefined || undefined}
    className={cn("app-button", className)}
    data-kind={kind}
    data-size={size}
    data-tone={tone}
  >
    {icon && <Icon name={icon} size={size === "lg" ? 26 : 20} />}
    <span>{busy ?? children}</span>
  </button>
);

/** A button that is only its icon, square: its label is its name to assistive technology and its tip on hover. */
export const AppIconButton = ({
  icon,
  label,
  kind = "quiet",
  tone,
  disabled,
  onClick,
}: {
  icon: IconMeaning;
  label: string;
  kind?: "secondary" | "quiet";
  tone?: "bad";
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className="app-button"
    data-kind={kind}
    data-size="icon"
    data-tone={tone}
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon name={icon} size={20} />
  </button>
);

/** A field: its label above, its value, a line under it that helps or, in the bad tone, says what is wrong. */
export const AppField = ({
  label,
  hint,
  error,
  icon,
  ...rest
}: {
  label: string;
  hint?: string;
  error?: string;
  icon?: IconMeaning;
} & React.InputHTMLAttributes<HTMLInputElement>) => {
  const id = useId();
  return (
    <label className="app-field" htmlFor={id} data-invalid={error !== undefined || undefined}>
      <span className="app-field__label">{label}</span>
      <span className="app-field__box">
        {icon && <Icon name={icon} size={20} />}
        <input id={id} {...rest} aria-invalid={error !== undefined || undefined} />
      </span>
      {(error ?? hint) && <span className="app-field__line">{error ?? hint}</span>}
    </label>
  );
};

/**
 * A code sent by email: its boxes over one real one-time-code input, so a pasted or autofilled code, a phone's code
 * suggestion and backspace all behave as in any code field. The box to type in next is lit; a refused code turns the
 * boxes bad until the player types again.
 */
export const AppCode = ({
  label,
  code,
  length,
  refused,
  disabled,
  onType,
}: {
  label: string;
  code: string;
  length: number;
  refused: boolean;
  disabled: boolean;
  onType: (value: string) => void;
}) => (
  <label className="app-code" data-refused={refused || undefined}>
    <span className="sr-only">{label}</span>
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      maxLength={length}
      value={code}
      disabled={disabled}
      aria-invalid={refused}
      onChange={(event) => onType(event.target.value)}
    />
    {Array.from({ length }, (_, index) => (
      <span key={index} aria-hidden className="app-code__box" data-at={index === code.length || undefined}>
        {code[index] ?? ""}
      </span>
    ))}
  </label>
);

/** A link from the app: the app's own pages (a path) open in place, another site (its address) in a new tab. */
export const AppLink = ({ to, ...rest }: { to: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) =>
  to.startsWith("/") ? <Link to={to} {...rest} /> : <a href={to} target="_blank" rel="noopener noreferrer" {...rest} />;

/** One place of the app's bar: where it leads, its word, its icon (or the player's portrait), and whether it is here. */
type AppBarPlace = {
  to: string;
  /** A place that opens over the page instead of leading anywhere (Connect), lit when it stands in the page's place. */
  onSelect?: () => void;
  label: string;
  icon?: IconMeaning;
  /** The player's portrait: the place shows the player (their name and portrait) instead of its word and icon. */
  portrait?: string;
  /** The place's own word where it shows the player ("You"): what assistive technology names it, with the player. */
  place?: string;
  current: boolean;
};

/**
 * The desktop's bar across the top of every page, over the page's painting: the app's mark, its places with their icons
 * and the current one in the accent, then at its right end the page's notice (offline, an update, install) and the
 * player, who opens You. A full-screen step keeps the mark and the notice alone.
 */
export const AppTopBar = ({
  mark,
  places,
  player,
  notice,
}: {
  mark: ReactNode;
  places: readonly AppBarPlace[];
  player: AppBarPlace | null;
  notice?: ReactNode;
}) => (
  <header data-band="bar" className="app-bar">
    <span data-role="lockup">{mark}</span>
    <nav aria-label="Tabs" className="app-bar__places">
      {places.map((place) => (
        <AppBarLink key={place.to} place={place} />
      ))}
    </nav>
    <span className="app-bar__end">
      {notice ? <div data-band="notice">{notice}</div> : null}
      {player && <AppBarLink place={player} />}
    </span>
  </header>
);

const AppBarLink = ({ place }: { place: AppBarPlace }) =>
  place.onSelect ? (
    <button
      type="button"
      data-role="tab"
      aria-current={place.current ? "page" : undefined}
      onClick={place.onSelect}
      className="app-bar__place"
    >
      {place.icon && <Icon name={place.icon} size={24} />}
      {place.label}
    </button>
  ) : (
    <AppLink
      to={place.to}
      data-role="tab"
      aria-current={place.current ? "page" : undefined}
      aria-label={place.place !== undefined ? `${place.place}: ${place.label}` : undefined}
      data-player={place.portrait !== undefined || undefined}
      className={cn("app-bar__place", place.portrait !== undefined && "app-bar__player")}
    >
      {place.portrait !== undefined ? (
        <>
          <span className="app-bar__name" title={place.label}>
            {place.label}
          </span>
          <AppPortrait src={place.portrait} name={place.label} size="sm" own />
        </>
      ) : (
        <>
          {place.icon && <Icon name={place.icon} size={24} />}
          {place.label}
        </>
      )}
    </AppLink>
  );

/** The keys that move between tabs, by where each sends the choice from the chosen tab's index. */
const TAB_KEYS: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

/**
 * A switch between views of one thing (Blitz | Eternum, Off | Important | All); the chosen one raised, and the chosen
 * view below it as its panel. One tab stop: the arrows, Home and End move the choice, as tabs do.
 */
export const AppTabs = <K extends string>({
  tabs,
  value,
  onChange,
  label,
  children,
}: {
  tabs: readonly { key: K; label: string; dot?: boolean }[];
  value: K;
  onChange?: (key: K) => void;
  label: string;
  /** The chosen view. */
  children?: ReactNode;
}) => {
  const id = useId();
  const tabId = (key: K) => `${id}-tab-${key}`;
  const choose = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const move = TAB_KEYS[event.key];
    if (!move || !onChange) return;
    event.preventDefault();
    const next = move(index, tabs.length);
    onChange(tabs[next].key);
    (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };
  return (
    <>
      <div className="app-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            id={tabId(tab.key)}
            type="button"
            role="tab"
            aria-selected={tab.key === value}
            aria-controls={children === undefined ? undefined : `${id}-panel`}
            tabIndex={tab.key === value ? 0 : -1}
            className="app-tabs__tab"
            onClick={() => onChange?.(tab.key)}
            onKeyDown={(event) => choose(event, index)}
          >
            {tab.label}
            {tab.dot && <i className="app-tabs__dot" aria-label="Something of yours" />}
          </button>
        ))}
      </div>
      {children !== undefined && (
        <div role="tabpanel" id={`${id}-panel`} aria-labelledby={tabId(value)}>
          {children}
        </div>
      )}
    </>
  );
};

/**
 * The app's one panel: its name (its icon before it, a cue at its end) over a rule, then its body. A panel about one
 * game or mode carries that mode's painting in its head. `flush` lets a list run to its edges. `className` places it,
 * never its look.
 */
export const AppPanel = ({
  title,
  icon,
  painting,
  cue,
  flush = false,
  className,
  children,
}: {
  title?: ReactNode;
  icon?: IconMeaning;
  painting?: Painting;
  cue?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <section className={cn("app-panel", className)} data-flush={flush || undefined}>
    {title !== undefined && (
      <header className="app-panel__head" data-painted={painting !== undefined || undefined}>
        {painting && <img className="app-panel__painting" alt="" {...paintingSources(painting)} sizes="50vw" />}
        {icon && <Icon name={icon} size={26} />}
        <h2>{title}</h2>
        {cue !== undefined && <span className="app-panel__cue">{cue}</span>}
      </header>
    )}
    <div className="app-panel__body">{children}</div>
  </section>
);

/**
 * A game's name as its age's lockup, the kit's complete title (emblem, title and Realms stamp), never typed; then, for
 * one game of the age, its start ("19:15").
 */
export const AppGameName = ({ age, name, when }: { age: Age; name: string; when?: string }) => (
  <span className="app-game-name">
    <img className="app-game-name__lockup" src={AGE_LOCKUP[age]} alt={name} />
    {when && <span className="app-game-name__when">{when}</span>}
  </span>
);

/**
 * An age as a tall column on its painting: its lockup over what it holds (Play's games of that age), in the age's
 * accent, the painting showing above.
 */
export const AppAgeColumn = ({
  age,
  painting,
  name,
  children,
}: {
  age: Age;
  painting: Painting;
  name: string;
  children: ReactNode;
}) => (
  <section className="app-age-column" data-age={age} aria-label={name}>
    <img
      className="app-age-column__painting"
      alt=""
      {...paintingSources(painting)}
      sizes="(min-width: 1024px) 25vw, 100vw"
    />
    <div className="app-age-column__body">
      <h2 className="app-age-column__name">
        <AppGameName age={age} name={name} />
      </h2>
      {children}
    </div>
  </section>
);

/**
 * A game, on its age's painting and in its age's accent: its title (an AppGameName, or a line where no game stands),
 * what stands (facts), and its one verb. `lead` is
 * Play's first card, the one gold verb of the page; `tile` sits among others.
 */
export const AppGameCard = ({
  age,
  painting,
  title,
  facts,
  verb,
  size = "tile",
  className,
}: {
  age: Age;
  painting: Painting;
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
      <h3 className="app-game-card__title">{title}</h3>
      {facts && <div className="app-game-card__facts">{facts}</div>}
      {verb && <div className="app-game-card__verb">{verb}</div>}
    </div>
  </article>
);

/**
 * One thing of a list: what leads it (a rank, a portrait, an icon), what it is and what it says, then what follows
 * (figures, its own button). The player's own row is lit. With `onClick` the whole row is the button that opens it;
 * with `href`, the link to another site, in a new tab. A row that opens is one target, its value and arrow included,
 * so what follows it holds no button of its own.
 */
export const AppRow = ({
  lead,
  title,
  detail,
  trail,
  own = false,
  onClick,
  href,
}: {
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trail?: ReactNode;
  own?: boolean;
  onClick?: () => void;
  href?: string;
}) => {
  const parts = (
    <>
      {lead !== undefined && <span className="app-row__lead">{lead}</span>}
      <span className="app-row__words">
        <span className="app-row__title">{title}</span>
        {detail !== undefined && <span className="app-row__detail">{detail}</span>}
      </span>
      {trail !== undefined && <span className="app-row__trail">{trail}</span>}
    </>
  );
  const lit = own || undefined;
  if (href)
    return (
      <a className="app-row" data-own={lit} href={href} target="_blank" rel="noopener noreferrer">
        {parts}
      </a>
    );
  if (onClick)
    return (
      <button type="button" className="app-row" data-own={lit} onClick={onClick}>
        {parts}
      </button>
    );
  return (
    <div className="app-row" data-own={lit}>
      {parts}
    </div>
  );
};

/** A rank at the head of a board's row; the top three in gold. */
export const AppRank = ({ rank }: { rank: number }) => (
  <span className="app-rank" data-top={rank <= 3 || undefined}>
    {rank}
  </span>
);

/** A small tag: a state (Live, Joined) in its tone, a count, an amount with its icon. */
export const AppChip = ({
  tone,
  icon,
  live = false,
  label,
  children,
}: {
  tone?: Tone | "gold";
  icon?: IconMeaning;
  /** A game under way: a dot that breathes before the word. */
  live?: boolean;
  /**
   * What a bare count means ("sites cleared"), where the icon alone says it: shown on hover, and read after the count,
   * so a column of numbers is never read as "0 0" (qa-app-1 P3-7).
   */
  label?: string;
  children: ReactNode;
}) => (
  <span className="app-chip" data-tone={tone} title={label}>
    {live && <i className="app-chip__live" aria-hidden />}
    {icon && <Icon name={icon} size={18} />}
    {children}
    {label && <span className="sr-only">{` ${label}`}</span>}
  </span>
);

/**
 * A figure that is the point of its panel (the countdown, a rank, the seats taken), with what it counts under it. A
 * figure that names a resource, a troop or a rank takes its icon: never a bare number.
 */
export const AppFigure = ({
  value,
  label,
  tone,
  icon,
}: {
  value: ReactNode;
  label?: ReactNode;
  tone?: Tone | "gold";
  icon?: IconMeaning;
}) => (
  <span className="app-figure" data-tone={tone}>
    <span className="app-figure__value">
      {icon && <Icon name={icon} size={44} />}
      {value}
    </span>
    {label !== undefined && <span className="app-figure__label">{label}</span>}
  </span>
);

/**
 * Something the page must say: its icon where one tells it at a glance, its line, why, and what the player can do about
 * it (Try again where trying again can help; Update, Later). Where its icon and actions already say it all (Install),
 * it has no line, only a name for assistive technology, so it stays one row in a desktop's bar and above a phone's tabs.
 */
export const AppNotice = ({
  tone,
  icon,
  actions,
  ...words
}: {
  tone?: Tone;
  icon?: IconMeaning;
  actions?: ReactNode;
} & ({ line: string } | { label: string })) => (
  <div
    className="app-notice"
    data-tone={tone}
    role={tone === "bad" ? "alert" : "status"}
    aria-label={"label" in words ? words.label : undefined}
  >
    {icon && <Icon name={icon} size={22} />}
    {"line" in words && <span className="app-notice__words">{words.line}</span>}
    {actions}
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

/**
 * A setting: its icon, its name and what it holds now, then its control (a switch, a chevron to open it, or to another
 * site with `href`).
 */
export const AppSetting = ({
  icon,
  name,
  value,
  control,
  onClick,
  href,
}: {
  icon: IconMeaning;
  name: string;
  value?: ReactNode;
  control?: ReactNode;
  onClick?: () => void;
  href?: string;
}) => (
  <AppRow
    lead={<Icon name={icon} size={26} />}
    title={name}
    trail={
      <>
        {value !== undefined && <span className="app-setting__value">{value}</span>}
        {control ?? ((onClick || href) && <Icon name="arrow-right" size={18} />)}
      </>
    }
    onClick={onClick}
    href={href}
  />
);

/** A choice among a few, drawn as tiles (the entry's seat, sword and shield): its icon, name, what it does, price. */
export const AppChoice = ({
  icon,
  title,
  detail,
  price,
  selected = false,
  disabled,
  onClick,
}: {
  icon: IconMeaning;
  title: string;
  detail?: ReactNode;
  price?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) => (
  <button type="button" className="app-choice" aria-pressed={selected} disabled={disabled} onClick={onClick}>
    {selected && <Icon name="check" size={20} className="app-choice__tick" />}
    <Icon name={icon} size={44} />
    <span className="app-choice__title">{title}</span>
    {detail !== undefined && <span className="app-choice__detail">{detail}</span>}
    {price !== undefined && <span className="app-choice__price">{price}</span>}
  </button>
);

/**
 * A ticket in the player's hand: a campaign's flyer in small, its art over its line and its stub. It comes sealed;
 * opened, it turns over once, and a golden one lands gold under its rays.
 */
export const AppTicket = ({
  art,
  line,
  stub,
  face = "sealed",
}: {
  art: ReactNode;
  line: string;
  stub: string;
  face?: "sealed" | "opened" | "golden";
}) => (
  <div className="app-ticket" data-face={face}>
    <div key={face} className="app-ticket__card">
      <div className="app-ticket__art">{art}</div>
      <p className="app-ticket__line">{line}</p>
      <p className="app-ticket__stub">{stub}</p>
    </div>
  </div>
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
  /** fill: as wide as its cell (a picker's square). */
  size?: "sm" | "md" | "lg" | "fill";
  own?: boolean;
}) => (
  <span className="app-portrait" data-size={size} data-own={own || undefined} title={name}>
    {src ? <img src={src} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
  </span>
);

/** A page's head: Back to where it came from (with Esc on a desktop), its title, and what it does at its end. */
export const AppPageHead = ({ title, back, aside }: { title: ReactNode; back?: To; aside?: ReactNode }) => (
  <header className="app-page-head">
    {back !== undefined && (
      <Link to={back} data-role="back" aria-label={BACK} className="app-page-head__back">
        <Icon name="arrow-left" size={22} />
        {BACK}
      </Link>
    )}
    <h1>{title}</h1>
    {aside !== undefined && <span className="app-page-head__aside">{aside}</span>}
  </header>
);

/** Nothing here yet, said once, with the one step that would fill it. */
export const AppEmpty = ({ icon, line, action }: { icon: IconMeaning; line: string; action?: ReactNode }) => (
  <div className="app-empty">
    <Icon name={icon} size={56} />
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

/**
 * A question before something that cannot be undone: its title, what it costs, and its way out and its verb. Given
 * `onClose` it asks over the page, which it dims, and closes as a sheet does: a press beside it, Escape, or the system
 * back, which closes the question rather than the page under it.
 */
export const AppDialog = ({
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
}) => {
  const dialog = (
    <section role="dialog" aria-label={title} aria-modal={onClose ? true : undefined} className="app-dialog">
      <h2>{title}</h2>
      {children && <div className="app-dialog__body">{children}</div>}
      <footer className="app-dialog__foot">{actions}</footer>
    </section>
  );
  return onClose ? <AppModalLayer onClose={onClose}>{dialog}</AppModalLayer> : dialog;
};

/**
 * The one layer that opens over the page (a dialog, Connect): the page dimmed behind it and inert while it is open, so
 * neither a pointer nor the keyboard reaches the page until it closes. It closes as a sheet does: a press beside it,
 * Escape, or the system back. `sheet` rises from the foot, as wide as the screen, instead of standing in the middle.
 */
export const AppModalLayer = ({
  onClose,
  sheet = false,
  children,
}: {
  onClose: () => void;
  sheet?: boolean;
  children: ReactNode;
}) => {
  useSheetCloses(onClose);
  const layer = useRef<HTMLDivElement>(null);
  useInertOutside(layer);
  return (
    <div
      ref={layer}
      data-surface="shell"
      className={cn("app-scrim", sheet && "app-scrim--sheet")}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {children}
    </div>
  );
};

/** Makes everything outside the layer inert while it is mounted: its siblings, and its ancestors' up to the body. */
const useInertOutside = (layer: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const made: Element[] = [];
    for (let node = layer.current; node?.parentElement && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || sibling.hasAttribute("inert")) continue;
        sibling.setAttribute("inert", "");
        made.push(sibling);
      }
    }
    return () => made.forEach((element) => element.removeAttribute("inert"));
  }, [layer]);
};
