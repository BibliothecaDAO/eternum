import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import "./hud-sheet.css";

/**
 * The HUD's elements: everything the game draws over the map, each built only from the HUD scope of the token file
 * (src/tokens.ts: HUD_TYPE, HUD_SHEET, HUD_MODES) by its classes (hud-sheet.css). A screen takes these and gives them
 * words and values, never a look of its own. /lab/kit shows each in every state, age and device.
 */

type ButtonKind = "primary" | "secondary" | "quiet";
type Tone = "good" | "bad" | "warn";

/** A button: primary is a screen's one verb, secondary sits beside it, quiet is a way out. */
export const HudButton = ({
  kind,
  size = "md",
  icon,
  children,
  ...rest
}: {
  kind: ButtonKind;
  size?: "md" | "sm";
  icon?: IconMeaning;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...rest} className="ui-button" data-kind={kind} data-size={size}>
    {icon && <Icon name={icon} size={size === "sm" ? 16 : 20} />}
    {children}
  </button>
);

/** A button that is only its painting, named for assistive technology and the app's tooltip. */
export const HudIconButton = ({
  icon,
  label,
  kind = "secondary",
  ...rest
}: { icon: IconMeaning; label: string; kind?: ButtonKind } & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" aria-label={label} {...rest} className="ui-button" data-kind={kind} data-icon-only>
    <Icon name={icon} size={20} />
  </button>
);

/** What is typed (a name, a search), in a well. */
export const HudField = ({
  value,
  placeholder,
  icon,
  state,
  disabled = false,
  onChange,
}: {
  value: string;
  placeholder?: string;
  icon?: IconMeaning;
  state?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => (
  <label className="ui-field" data-state={state}>
    {icon && <Icon name={icon} size={16} />}
    <input
      className="!w-48"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const formatAmount = (amount: number) => Math.round(amount).toLocaleString("en-US");

/**
 * How many troops, by dragging (the kit's amount slider, in the HUD's face): the amount typed exactly beside its name,
 * the track between its ends (each end takes its amount), a stop where what fits runs out, and quick steps taking a
 * share of what fits.
 */
export const HudAmountSlider = ({
  name,
  value,
  max,
  stop,
  steps = [0.25, 0.5, 0.75],
  note,
  disabled = false,
  onChange,
}: {
  name: string;
  value: number;
  max: number;
  /** Where what can go runs out before the end (the army's room): the thumb stops there. */
  stop?: number;
  steps?: readonly number[];
  note?: ReactNode;
  disabled?: boolean;
  onChange: (amount: number) => void;
}) => {
  const most = Math.min(stop ?? max, max);
  const share = (amount: number) => (max > 0 ? (amount / max) * 100 : 0);
  return (
    <div className="ui-slider">
      <div className="ui-slider__head">
        <span className="ui-slider__name">{name}</span>
        <label className="ui-field">
          <span className="sr-only">{name}</span>
          <input
            inputMode="numeric"
            value={formatAmount(value)}
            disabled={disabled}
            onChange={(event) => onChange(Math.min(most, Number(event.target.value.replace(/\D/g, "")) || 0))}
          />
        </label>
        <span className="ui-slider__note">of {formatAmount(most)}</span>
      </div>
      <div className="ui-slider__track">
        <button type="button" className="ui-slider__end" disabled={disabled} onClick={() => onChange(0)}>
          0
        </button>
        <span className="ui-slider__rail">
          <input
            type="range"
            aria-label={name}
            min={0}
            max={max}
            value={value}
            disabled={disabled}
            style={{ "--fill": `${share(value)}%` } as React.CSSProperties}
            onChange={(event) => onChange(Math.min(Number(event.target.value), most))}
          />
          {stop !== undefined && stop < max && (
            <u aria-hidden className="ui-slider__stop" style={{ left: `${share(stop)}%` }} />
          )}
        </span>
        <button type="button" className="ui-slider__end" disabled={disabled} onClick={() => onChange(most)}>
          {formatAmount(most)}
        </button>
      </div>
      <div className="ui-slider__steps">
        {steps.map((step) => (
          <HudButton
            key={step}
            kind="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(Math.round(most * step))}
          >
            {step * 100}%
          </HudButton>
        ))}
        {note !== undefined && <span className="ui-slider__note ml-auto self-center">{note}</span>}
      </div>
    </div>
  );
};

/** What a transfer moves: one row per resource, its painting and name, what is held, a slider and the amount typed. */
export const HudTransfer = ({
  rows,
  onChange,
}: {
  rows: readonly { icon: IconMeaning; name: string; held: number; value: number; state?: string }[];
  onChange: (index: number, amount: number) => void;
}) => (
  <div className="ui-transfer">
    {rows.map((row, index) => (
      <div key={row.name} className="ui-transfer__row" data-state={row.state}>
        <span className="ui-transfer__what">
          <Icon name={row.icon} size={24} />
          <span className="flex flex-col">
            <span>{row.name}</span>
            <span className="ui-transfer__held">{formatAmount(row.held)} held</span>
          </span>
        </span>
        <span className="ui-slider">
          <input
            type="range"
            aria-label={row.name}
            min={0}
            max={row.held}
            value={row.value}
            style={{ "--fill": `${row.held > 0 ? (row.value / row.held) * 100 : 0}%` } as React.CSSProperties}
            onChange={(event) => onChange(index, Number(event.target.value))}
          />
        </span>
        <label className="ui-field">
          <span className="sr-only">{row.name}</span>
          <input
            inputMode="numeric"
            value={formatAmount(row.value)}
            onChange={(event) =>
              onChange(index, Math.min(row.held, Number(event.target.value.replace(/\D/g, "")) || 0))
            }
          />
        </label>
      </div>
    ))}
  </div>
);

/**
 * The app's one tooltip: a line, and when the thing cannot be done, why and when it can; how to do it as a cue. The map's
 * order line is one ("Deploy an army here" / "Right-click").
 */
export const HudTip = ({ line, why, how }: { line: string; why?: string; how?: string }) => (
  <span className="ui-tip" role="tooltip">
    <span className="ui-tip__line">{line}</span>
    {why && <span className="ui-tip__why">{why}</span>}
    {how && <span className="ui-tip__how">{how}</span>}
  </span>
);

/** The HUD's one panel (the InfoBubble look): a header band naming it, a cue at its end, then its body. */
export const HudPanel = ({
  title,
  cue,
  children,
  ...rest
}: { title?: ReactNode; cue?: ReactNode; children: ReactNode } & HTMLAttributes<HTMLElement>) => (
  <section {...rest} className="ui ui-panel">
    {title !== undefined && (
      <header className="ui-panel__head">
        <span>{title}</span>
        {cue !== undefined && <span className="ui-panel__cue">{cue}</span>}
      </header>
    )}
    <div className="ui-panel__body">{children}</div>
  </section>
);

/** A strip of choices; the chosen one in the age's accent. */
export const HudTabs = <K extends string>({
  tabs,
  value,
  onChange,
  states = {},
}: {
  tabs: readonly { key: K; label: string; count?: number; disabled?: boolean }[];
  value: K;
  onChange: (key: K) => void;
  /** The lab's forced state per tab. */
  states?: Partial<Record<K, string>>;
}) => (
  <div className="ui-tabs" role="tablist">
    {tabs.map((tab) => (
      <button
        key={tab.key}
        type="button"
        role="tab"
        className="ui-tab"
        aria-selected={tab.key === value}
        disabled={tab.disabled}
        data-state={states[tab.key]}
        onClick={() => onChange(tab.key)}
      >
        {tab.label}
        {tab.count !== undefined && <HudChip>{tab.count}</HudChip>}
      </button>
    ))}
  </div>
);

/** A small tag: a count in the age's accent, or a state in its tone. */
export const HudChip = ({ tone, children }: { tone?: Tone; children: ReactNode }) => (
  <span className="ui-chip" data-tone={tone}>
    {children}
  </span>
);

/** A troop tier: T1 blue, T2 green, T3 purple. */
export const HudTierChip = ({ tier }: { tier: 1 | 2 | 3 }) => (
  <span className="ui-chip" data-tier={tier}>
    T{tier}
  </span>
);

/**
 * A painting in a round well with its numbers on the rim, all in one badge: buildings top left, the time left top
 * right, the amount on the foot; how far production has come as an arc.
 */
export const HudRing = ({
  icon,
  label,
  corner,
  timer,
  foot,
  progress,
}: {
  icon: IconMeaning;
  label: string;
  corner?: ReactNode;
  timer?: ReactNode;
  foot?: ReactNode;
  progress?: number;
}) => (
  <span className="ui-ring" role="img" aria-label={label}>
    {progress !== undefined && (
      <span
        className="ui-ring__arc"
        style={{ "--ring-arc": `${Math.round(Math.min(1, Math.max(0, progress)) * 360)}deg` } as React.CSSProperties}
      />
    )}
    <span className="ui-ring__face">
      <Icon name={icon} size={30} />
    </span>
    {corner !== undefined && (
      <span className="ui-ring__badge" data-at="corner">
        {corner}
      </span>
    )}
    {timer !== undefined && (
      <span className="ui-ring__badge" data-at="timer">
        {timer}
      </span>
    )}
    {foot !== undefined && (
      <span className="ui-ring__badge" data-at="foot">
        {foot}
      </span>
    )}
  </span>
);

/** One thing of a list: what it is and what it says; hover lights it, the chosen one carries a bar in the accent. */
export const HudRow = ({
  lead,
  title,
  detail,
  selected = false,
  state,
}: {
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  selected?: boolean;
  state?: string;
}) => (
  <div className="ui-row" role="option" aria-selected={selected} data-state={state}>
    {lead}
    <span className="flex min-w-0 flex-col">
      <span className="ui-row__title">{title}</span>
      {detail !== undefined && <span className="ui-row__detail">{detail}</span>}
    </span>
  </div>
);

/** What happened, said once: its time, a mark in its tone, the words (a name or a gain in the accent). */
export const HudEventRow = ({ time, tone, children }: { time: string; tone?: Tone; children: ReactNode }) => (
  <div className="ui-event" data-tone={tone}>
    <span className="ui-event__time">{time}</span>
    <span className="ui-event__mark" aria-hidden="true" />
    <span className="ui-event__text">{children}</span>
  </div>
);

/** A line the game says about the screen it sits in: a refusal, a warning, a success, and why. */
export const HudNotice = ({ tone, line, why }: { tone?: Tone; line: string; why?: string }) => (
  <div className="ui-notice" data-tone={tone} role={tone === "bad" ? "alert" : "status"}>
    <span className="flex flex-col">
      <span>{line}</span>
      {why && <span className="ui-notice__why">{why}</span>}
    </span>
  </div>
);

/**
 * A panel the size of a task: its title bar with a way out, its body, and its foot: what it costs on the left, the way
 * out and the one verb on the right, the verb last.
 */
export const HudWindow = ({
  title,
  icon,
  onClose,
  note,
  actions,
  children,
}: {
  title: string;
  icon?: IconMeaning;
  onClose: () => void;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section className="ui ui-window" role="dialog" aria-label={title}>
    <header className="ui-window__bar">
      {icon && <Icon name={icon} size={22} />}
      <span>{title}</span>
      <HudIconButton icon="close" label="Close" kind="quiet" onClick={onClose} />
    </header>
    <div className="ui-window__body">{children}</div>
    {(note !== undefined || actions !== undefined) && (
      <footer className="ui-window__foot">
        <span className="ui-window__note">{note}</span>
        {actions}
      </footer>
    )}
  </section>
);

/** A question that stops the task: what it does and costs, the way back, and the verb (red when it cannot be undone). */
export const HudConfirm = ({
  question,
  children,
  verb,
  back = "Cancel",
  tone,
  onConfirm,
  onBack,
}: {
  question: string;
  children?: ReactNode;
  verb: string;
  back?: string;
  tone?: "bad";
  onConfirm: () => void;
  onBack: () => void;
}) => (
  <section className="ui ui-confirm" role="alertdialog" aria-label={question} data-tone={tone}>
    <div className="ui-confirm__body">
      <span className="ui-confirm__question">{question}</span>
      {children}
    </div>
    <footer className="ui-window__foot">
      <span className="ui-window__note" />
      <HudButton kind="quiet" onClick={onBack}>
        {back}
      </HudButton>
      <HudButton kind="primary" onClick={onConfirm}>
        {verb}
      </HudButton>
    </footer>
  </section>
);

/** A choice's trigger: what is chosen, and the cue that it opens. */
export const HudSelect = ({ value, state, onClick }: { value: string; state?: string; onClick?: () => void }) => (
  <button type="button" className="ui-select" data-state={state} aria-haspopup="listbox" onClick={onClick}>
    <span>{value}</span>
    <Icon name="chevron-down" size={16} />
  </button>
);

/** A list of choices opened from a select or a right-click: each item, the chosen one checked, a rule between groups. */
export const HudMenu = ({
  items,
}: {
  items: readonly (
    | { kind: "rule" }
    | {
        kind?: "item";
        label: string;
        icon?: IconMeaning;
        hint?: string;
        checked?: boolean;
        disabled?: boolean;
        tone?: "bad";
        state?: string;
      }
  )[];
}) => (
  <div className="ui ui-menu" role="menu">
    {items.map((item, index) =>
      item.kind === "rule" ? (
        <span key={index} className="ui-menu__rule" role="separator" />
      ) : (
        <button
          key={index}
          type="button"
          role="menuitemradio"
          className="ui-menu__item"
          aria-checked={item.checked ?? false}
          disabled={item.disabled}
          data-tone={item.tone}
          data-state={item.state}
        >
          {item.icon && <Icon name={item.icon} size={16} />}
          {item.label}
          {item.hint && <span className="ui-menu__hint">{item.hint}</span>}
        </button>
      ),
    )}
  </div>
);

/** On or off, at once. */
export const HudSwitch = ({
  on,
  label,
  disabled,
  state,
  onChange,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  state?: string;
  onChange: (on: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    data-state={state}
    className="ui-switch"
    onClick={() => onChange(!on)}
  />
);

/** One of several things chosen together. */
export const HudCheck = ({
  checked,
  label,
  disabled,
  state,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  state?: string;
  onChange: (checked: boolean) => void;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    data-state={state}
    className="ui-check"
    onClick={() => onChange(!checked)}
  >
    {checked && <Icon name="check" size={14} />}
  </button>
);

/** A setting: what it sets and what that does, its control at the end. */
export const HudSetting = ({ name, about, children }: { name: string; about?: string; children: ReactNode }) => (
  <div className="ui-setting">
    <span className="ui-setting__words">
      <span className="ui-setting__name">{name}</span>
      {about && <span className="ui-setting__about">{about}</span>}
    </span>
    {children}
  </div>
);

/** One of the HUD's round actions: its painting in a disc, its word under it, a count to act on on its rim. */
export const HudBubble = ({
  icon,
  word,
  count,
  pressed,
  disabled,
  state,
}: {
  icon: IconMeaning;
  word: string;
  count?: number;
  pressed?: boolean;
  disabled?: boolean;
  state?: string;
}) => (
  <button type="button" className="ui-bubble" aria-pressed={pressed} disabled={disabled} data-state={state}>
    <span className="ui-bubble__disc">
      <Icon name={icon} size={26} />
      {count !== undefined && count > 0 && <span className="ui-badge">{count}</span>}
    </span>
    {word}
  </button>
);

/** How full a thing is (stamina, production, a load), from 0 to 1, in a tone. */
export const HudMeter = ({ share, tone, label }: { share: number; tone?: Tone; label: string }) => (
  <span
    className="ui-meter block"
    role="meter"
    aria-label={label}
    aria-valuenow={Math.round(share * 100)}
    aria-valuemin={0}
    aria-valuemax={100}
    data-tone={tone}
  >
    <i style={{ width: `${Math.min(1, Math.max(0, share)) * 100}%` }} />
  </span>
);

/** An answer on its way: a spinner and what is awaited. */
export const HudLoading = ({ line }: { line: string }) => (
  <span className="ui-loading" role="status">
    <span className="ui-spinner" aria-hidden="true" />
    {line}
  </span>
);

/** Rows standing in for a list that is coming. */
export const HudSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <span className="flex flex-col gap-2" aria-hidden="true">
    {Array.from({ length: rows }, (_, index) => (
      <span key={index} className="ui-skeleton block" style={{ width: `${90 - index * 15}%` }} />
    ))}
  </span>
);

/** Nothing to show yet, said once, with the one thing that would fill it. */
export const HudEmpty = ({ icon, line, action }: { icon: IconMeaning; line: string; action?: ReactNode }) => (
  <div className="ui-empty">
    <Icon name={icon} size={28} />
    <span className="ui-empty__line">{line}</span>
    {action}
  </div>
);

/** The HUD's top line: its readings in one rounded strip, a rule between them. */
export const HudPill = ({ children }: { children: readonly ReactNode[] }) => (
  <div className="ui ui-pill">
    {children.map((child, index) => (
      <span key={index} className="contents">
        {index > 0 && <span className="ui-pill__rule" aria-hidden="true" />}
        {child}
      </span>
    ))}
  </div>
);

/** A player's or an army's painting, centred in its disc. */
export const HudPortrait = ({ icon, label }: { icon: IconMeaning; label: string }) => (
  <span className="ui-portrait" role="img" aria-label={label}>
    <Icon name={icon} size={30} />
  </span>
);

/** The minimap's frame: a panel with no header, its map in a well. */
export const HudMinimapFrame = ({ children }: { children: ReactNode }) => (
  <section className="ui ui-panel ui-minimap" aria-label="Minimap">
    <div className="ui-minimap__well">{children}</div>
  </section>
);
