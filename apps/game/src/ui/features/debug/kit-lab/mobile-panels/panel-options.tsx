import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudIconButton } from "@/ui/design-system/kit/hud-elements";
import { type CSSProperties, forwardRef, type ReactNode, useLayoutEffect, useRef, useState } from "react";

import { type Moment, MOMENT_WORDS, type Option, type PhoneSize } from "./moments";
import { PhoneFrame } from "./phone-frame";

/** Panels that read rather than act on a tile: option C gives them the whole screen between the strip and the places. */
const READING: ReadonlySet<Moment> = new Set(["research", "chat"]);

/**
 * The HUD's bands on a phone as the live client draws them (the walk's measurements, 390×844 and 360×740): the strip
 * 84 px under an 8 px gutter, Next up's row 44 px under it, the dock 72 px and the place bar 66 px at the foot.
 */
const BAND = { gutter: 8, strip: 84, slimStrip: 48, row: 44, gap: 6, dock: 72, places: 66 } as const;
/** Today's sheet: half the screen, its grip band and title row 110 px together (HudSheet: SheetHandle + PanelHead). */
const TODAY_HEAD = { grip: 52, title: 58 } as const;
const SLIM_HEAD = 44;

/** One option's phone at one moment, the map framed on the acted-on tile where the option frames it. */
export const OptionScreen = ({
  option,
  moment,
  size,
  scale,
  slimStrip,
  go,
}: {
  option: Option;
  moment: Moment;
  size: PhoneSize;
  scale: number;
  slimStrip: boolean;
  go: (moment: Moment) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const [panelTop, setPanelTop] = useState<number | null>(null);
  const strip = slimStrip ? BAND.slimStrip : BAND.strip;
  const topBand = BAND.gutter + strip;
  const rowTop = topBand + BAND.gap;
  const placesTop = size.height - BAND.gutter - BAND.places;
  const aboveBars = size.height - placesTop + BAND.gap;

  useLayoutEffect(() => setPanelTop(panel.current ? panel.current.offsetTop : null));

  const layout = layoutOf(option, moment, expanded);
  const openTop = layout.nextUp ? rowTop + BAND.row : topBand;
  // Today the camera stays where the tap left it; the options frame the tile in the map left open.
  const focusY =
    option === "today" ? size.height * 0.6 : Math.round((openTop + (panelTop ?? placesTop - BAND.dock)) / 2);
  const close = () => {
    setExpanded(false);
    go("rest");
  };

  return (
    <PhoneFrame size={size} scale={scale} focusY={focusY}>
      <div className="ui absolute inset-0 pointer-events-none [&>*]:pointer-events-auto">
        <Strip top={BAND.gutter} height={strip} slim={slimStrip} />
        {layout.nextUp && <NextUp top={rowTop} />}
        {layout.dock && <Dock bottom={aboveBars} onDeploy={() => go("deploy")} />}
        {layout.places && <Places bottom={BAND.gutter} lit={moment} go={go} />}
        {layout.panel && (
          <Panel
            ref={panel}
            place={layout.panel}
            box={panelBox(layout.panel, size, rowTop, aboveBars)}
            tallHead={option === "today"}
            title={MOMENT_WORDS[moment]}
            onClose={option === "c" && READING.has(moment) ? undefined : close}
            onMore={option === "b" ? () => setExpanded(!expanded) : undefined}
            expanded={expanded}
            verb={layout.verbPinned ? VERBS[moment] : undefined}
          >
            <Body moment={moment} peek={option === "b" && !expanded} verbInBody={!layout.verbPinned} />
          </Panel>
        )}
      </div>
    </PhoneFrame>
  );
};

type PanelPlace = "half" | "fit" | "peek" | "full" | "card" | "page";
type Layout = { nextUp: boolean; dock: boolean; places: boolean; panel?: PanelPlace; verbPinned: boolean };

/** What each option shows at each moment: which bands stay, and where the panel stands. */
const layoutOf = (option: Option, moment: Moment, expanded: boolean): Layout => {
  if (moment === "rest") return { nextUp: true, dock: true, places: true, verbPinned: true };
  switch (option) {
    case "today":
      // The site card fits its content; every other sheet takes half the screen. The build sheet's verb scrolls.
      return {
        nextUp: true,
        dock: false,
        places: true,
        panel: moment === "site" ? "fit" : "half",
        verbPinned: moment !== "build",
      };
    case "a":
      return { nextUp: false, dock: false, places: true, panel: "fit", verbPinned: true };
    case "b":
      return { nextUp: false, dock: false, places: true, panel: expanded ? "full" : "peek", verbPinned: true };
    case "c":
      return READING.has(moment)
        ? { nextUp: false, dock: false, places: true, panel: "page", verbPinned: true }
        : { nextUp: false, dock: false, places: false, panel: "card", verbPinned: true };
  }
};

const PANEL_STYLE: CSSProperties = { left: BAND.gutter, right: BAND.gutter };
/** The most of the screen a panel sized to its content takes. */
const MOST_OF_SCREEN = 0.45;

type PanelBox = Pick<CSSProperties, "top" | "bottom" | "height" | "maxHeight">;

/** Where a panel stands on the phone for its place: `rowTop` under the strip, `aboveBars` over the place bar. */
const panelBox = (place: PanelPlace, size: PhoneSize, rowTop: number, aboveBars: number): PanelBox => {
  switch (place) {
    case "half":
      return { bottom: aboveBars, height: size.height / 2 };
    case "fit":
      return { bottom: aboveBars, maxHeight: size.height * MOST_OF_SCREEN };
    case "peek":
      return { bottom: aboveBars };
    case "full":
    case "page":
      return { top: rowTop, bottom: aboveBars };
    case "card":
      return { bottom: BAND.gutter, maxHeight: size.height * MOST_OF_SCREEN };
  }
};

type PanelProps = {
  place: PanelPlace;
  box: PanelBox;
  tallHead: boolean;
  title: string;
  onClose?: () => void;
  onMore?: () => void;
  expanded: boolean;
  verb?: ReactNode;
  children: ReactNode;
};

const Panel = forwardRef<HTMLElement, PanelProps>(
  ({ place, box, tallHead, title, onClose, onMore, expanded, verb, children }, ref) => (
    <section
      ref={ref}
      aria-label={title}
      data-panel={place}
      className="ui-panel absolute flex flex-col"
      style={{ ...PANEL_STYLE, ...box }}
    >
      {tallHead && (
        <div className="grid shrink-0 place-items-center" style={{ height: TODAY_HEAD.grip }}>
          <i className="ui-sheet__grip" />
        </div>
      )}
      <header
        className="flex shrink-0 items-center justify-between gap-2 border-b border-hud-line px-3"
        style={{ height: tallHead ? TODAY_HEAD.title : SLIM_HEAD }}
      >
        <span className="text-hud-title text-hud-muted">{title}</span>
        <span className="flex gap-1">
          {onMore && (
            <HudIconButton
              icon={expanded ? "chevron-down" : "chevron-up"}
              label={expanded ? "Less" : "More"}
              kind="quiet"
              size="sm"
              onClick={onMore}
            />
          )}
          {onClose && <HudIconButton icon="close" label="Close" kind="quiet" size="sm" onClick={onClose} />}
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">{children}</div>
      {verb && <footer className="ui-window__foot ui-actions shrink-0">{verb}</footer>}
    </section>
  ),
);
Panel.displayName = "Panel";

const Strip = ({ top, height, slim }: { top: number; height: number; slim: boolean }) => (
  <div className="ui-panel absolute flex flex-col justify-center gap-1 px-3" style={{ ...PANEL_STYLE, top, height }}>
    <div className="flex items-center justify-between">
      <span className="grid size-9 place-items-center rounded-full border-2 border-[#a78bfa] text-hud-strong">1</span>
      {STORES.map(([icon, amount]) => (
        <span key={icon} className="flex items-center gap-1 text-hud-strong">
          <Icon name={icon} size={18} />
          {amount}
        </span>
      ))}
    </div>
    {!slim && <p className="m-0 text-center text-hud-label">Day ends 04:01 · 2h 56m left · Tomorrow lasts 4h</p>}
  </div>
);

const STORES: [IconMeaning, string][] = [
  ["essence", "453"],
  ["labor", "5,600"],
  ["wheat", "19"],
  ["troops", "6,000"],
];

const NextUp = ({ top }: { top: number }) => (
  <div
    className="absolute flex gap-1.5 !pointer-events-none [&>*]:pointer-events-auto"
    style={{ ...PANEL_STYLE, top, height: BAND.row }}
  >
    <div className="ui-pill flex min-w-0 flex-1 items-center gap-2 px-3">
      <Icon name="target" size={16} />
      <span className="truncate text-hud-body">Your labor store is full: what does not fit is gone</span>
      <Icon name="chevron-up" size={14} />
    </div>
    <div className="ui-pill flex items-center gap-1 px-3">
      <Icon name="lords" size={18} />0
    </div>
  </div>
);

const Dock = ({ bottom, onDeploy }: { bottom: number; onDeploy: () => void }) => (
  <div
    className="absolute flex gap-2 !pointer-events-none [&>*]:pointer-events-auto"
    style={{ ...PANEL_STYLE, bottom, height: BAND.dock }}
  >
    <div className="ui-panel grid w-[56px] place-items-center text-hud-label">
      <Icon name="knight-t1" size={28} />
      1,498
    </div>
    <button type="button" className="ui-panel grid w-[56px] place-items-center" aria-label="Deploy" onClick={onDeploy}>
      <Icon name="plus" size={22} />
    </button>
    <div className="ui-panel grid w-[56px] place-items-center text-hud-muted">3</div>
  </div>
);

const PLACES: [string, IconMeaning, Moment | undefined][] = [
  ["Map", "map", "rest"],
  ["Realm", "realm", undefined],
  ["Research", "research", "research"],
  ["Log", "news", undefined],
  ["Chat", "chat", "chat"],
  ["Menu", "menu", undefined],
];

const Places = ({ bottom, lit, go }: { bottom: number; lit: Moment; go: (moment: Moment) => void }) => (
  <nav
    className="ui-panel absolute flex !flex-row items-stretch"
    style={{ ...PANEL_STYLE, bottom, height: BAND.places }}
  >
    {PLACES.map(([word, icon, opens]) => (
      <button
        key={word}
        type="button"
        aria-pressed={opens === lit}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-hud-label aria-pressed:text-[#f5d38a]"
        onClick={() => opens && go(opens === lit ? "rest" : opens)}
      >
        <Icon name={icon} size={22} />
        {word}
      </button>
    ))}
  </nav>
);

/** Each moment's one verb, as the live panel words it. */
const VERBS: Record<Moment, ReactNode> = {
  rest: null,
  build: (
    <HudButton kind="primary" icon="build">
      Build Farm · 400 labor
    </HudButton>
  ),
  deploy: (
    <HudButton kind="primary" icon="deploy">
      Deploy 10 · 10 wheat
    </HudButton>
  ),
  site: (
    <>
      <HudButton kind="secondary">Details</HudButton>
      <HudButton kind="primary" icon="attack">
        Attack
      </HudButton>
    </>
  ),
  research: (
    <HudButton kind="primary" icon="research">
      Research · 2,000 Essence
    </HudButton>
  ),
  chat: (
    <div className="flex w-full gap-2">
      <span className="ui-field flex-1 px-3 py-2 text-hud-muted">Message world chat…</span>
      <HudButton kind="secondary">Send</HudButton>
    </div>
  ),
};

/** A moment's content, whole, or its peek: the one decision a player makes there, in one row. */
const Body = ({ moment, peek, verbInBody }: { moment: Moment; peek: boolean; verbInBody: boolean }) => {
  const content = {
    rest: null,
    build: <Buildings row={peek} />,
    deploy: <DeployBody peek={peek} />,
    site: <Forecast peek={peek} />,
    research: <ResearchBody peek={peek} />,
    chat: <ChatBody peek={peek} />,
  }[moment];
  return (
    <>
      {content}
      {verbInBody && <div className="pt-2">{VERBS[moment]}</div>}
    </>
  );
};

const BUILDINGS: [string, IconMeaning, string][] = [
  ["Farm", "farm", "+5/min · 400"],
  ["Barracks", "barracks", "+1.7/min · 800"],
  ["Workshop", "workshop", "+3.4/min · 2,000"],
  ["Hut", "workers-hut", "+6 people · 300"],
  ["War hall", "war-hall", "Common · 2"],
  ["Supply yard", "supply-yard", "Common · 2"],
  ["Scouts' lodge", "scout-lodge", "Common · 2"],
  ["Hearth", "hearth", "Common · 2"],
];

const Buildings = ({ row }: { row: boolean }) => (
  <div className={row ? "flex gap-2 overflow-x-auto pb-1" : "grid grid-cols-3 gap-2"}>
    {BUILDINGS.map(([name, icon, line], index) => (
      <div
        key={name}
        className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg border p-1.5 text-center"
        style={{
          width: row ? 96 : undefined,
          borderColor: index === 0 ? "#a78bfa" : "var(--hud-line)",
          background: "var(--hud-well)",
        }}
      >
        <Icon name={icon} size={30} />
        <span className="text-hud-strong">{name}</span>
        <span className="text-hud-label text-hud-muted">{line}</span>
      </div>
    ))}
  </div>
);

const DeployBody = ({ peek }: { peek: boolean }) => (
  <>
    <div className="flex items-center gap-2">
      <Icon name="knight-t1" size={32} />
      <span className="ui-field flex-1 px-3 py-2">10</span>
      <HudButton kind="secondary" size="sm">
        Max
      </HudButton>
      <span className="text-hud-label text-hud-muted">of 10</span>
    </div>
    <p className="m-0 text-hud-body">Army 1 starts full: 120/120 stamina</p>
    {!peek && (
      <p className="m-0 text-hud-label text-hud-muted">Leaves wheat to march 110 tiles · the tile beside the realm</p>
    )}
  </>
);

const Forecast = ({ peek }: { peek: boolean }) => (
  <>
    <p className="m-0 text-hud-strong">Grimtear Camp · T1 300 guards</p>
    <p className="m-0 text-hud-body">You lose 107 (7%) · you kill 300 (100%): cleared</p>
    {!peek && <p className="m-0 text-hud-label text-hud-muted">When cleared: +1,200 Labor · +20 XP</p>}
  </>
);

const RESEARCH_TREE: [string, [string, IconMeaning][]][] = [
  [
    "Economy",
    [
      ["Farm", "farm"],
      ["Workshop", "workshop"],
      ["Hut", "workers-hut"],
    ],
  ],
  [
    "Army",
    [
      ["Barracks", "barracks"],
      ["War hall", "war-hall"],
      ["Supply yard", "supply-yard"],
    ],
  ],
  [
    "Castle",
    [
      ["Shrine", "shrine"],
      ["Well", "well"],
      ["Ethereal I", "spire"],
    ],
  ],
];

const ResearchBody = ({ peek }: { peek: boolean }) => (
  <>
    <p className="m-0 text-hud-strong">Workshop · Common → Uncommon</p>
    <p className="m-0 text-hud-body">Pick a side for the season: Tools +25% labor, or Storeroom +50% store</p>
    {!peek && (
      <div className="grid grid-cols-3 gap-2">
        {RESEARCH_TREE.map(([branch, nodes]) => (
          <div key={branch} className="flex flex-col gap-1.5">
            <span className="text-hud-label text-hud-muted">{branch}</span>
            {nodes.map(([name, icon]) => (
              <div
                key={name}
                className="flex flex-col items-center rounded-lg border p-1.5 text-hud-label"
                style={{
                  borderColor: name === "Workshop" ? "#a78bfa" : "var(--hud-line)",
                  background: "var(--hud-well)",
                }}
              >
                <Icon name={icon} size={28} />
                {name}
              </div>
            ))}
          </div>
        ))}
      </div>
    )}
  </>
);

const MESSAGES = ["<djizus> gm", "<uxplay> ux test", "<matthias> gmgm", "<djizus> ohayo", "<aldric> who has wheat?"];

const ChatBody = ({ peek }: { peek: boolean }) => (
  <>
    <div className="flex gap-1">
      <HudButton kind="secondary" size="sm">
        World
      </HudButton>
      <HudButton kind="quiet" size="sm">
        Game
      </HudButton>
      <HudButton kind="quiet" size="sm">
        + DM
      </HudButton>
    </div>
    {(peek ? MESSAGES.slice(-2) : MESSAGES).map((line) => (
      <p key={line} className="m-0 text-hud-body">
        {line}
      </p>
    ))}
  </>
);
