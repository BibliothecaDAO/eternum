import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { HudButton, HudChip, HudConfirm, HudNotice, HudPanel, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { BARRACKS, comesHomeAtDayEnd, HUT, TODAY } from "@/ui/design-system/kit/words";
import { DayEnds } from "@/ui/features/frontier/day-ends";
import { DayTotalsGrid } from "@/ui/features/frontier/log/day-totals";
import type { ReactNode } from "react";

/**
 * In-game clarity, design round 1 (Devcon in-person feedback, 4 November): the options for the owner's pick, drawn with
 * the HUD kit's own parts on the HUD lab's fixture realm. Lab only: the picked option is built into the game, its words
 * into words.ts, and this file goes.
 */
export type ClarityMock =
  | "pop-now"
  | "pop-a"
  | "pop-b"
  | "pop-c"
  | "day-a"
  | "day-b"
  | "day-b-final"
  | "day-c"
  | "next-a"
  | "next-b";

/** The draft words, one place, until an option is picked. */
const WORDS = {
  pop: {
    /** A and B: the Hut built on the plot the player tapped, in one press. */
    hutHere: "Build a Hut here",
    /** B: Build pressed on a building the realm has no room for. */
    full: "Population full",
    another: "Choose another",
    /** C: the alert the moment the last free population is taken. */
    alert: "Population full · 18 / 18",
    alertVerb: "Build a Hut",
  },
  day: {
    endsIn: (left: string) => `Day 12 ends in ${left}`,
    toDo: (count: number) => `${count} left to do`,
    gone: "Gone at day end",
    kept: "Kept",
    goneList: [
      { icon: "map", line: "Today's map" },
      { icon: "map-army", line: "Armies on it" },
      { icon: "chest", line: "Unopened chests" },
      { icon: "labor", line: "Unclaimed Labor" },
    ],
    keptList: [
      { icon: "realm", line: "Buildings, research" },
      { icon: "troops", line: "Stores, troops at home" },
      { icon: "lords", line: "LORDS" },
    ],
    before: "Before it ends",
    claim: "Claim today's Labor",
    claimVerb: "Claim",
    chest: "Chest beside Army 1",
    chestVerb: "Show",
    stamina: "Army 2: 150 stamina",
    staminaVerb: "Select",
    open: "Open",
    /** C: one card, once, ten minutes before the end. */
    finalVerb: "Got it",
  },
  next: {
    /** B: the day's own list where Next up stood. */
    done: "Claimed today's Labor",
    camp: "Clear today's Camp",
    campVerb: "Show",
  },
} as const satisfies Record<string, unknown>;

const noop = () => undefined;

/** Homecoming's troops in the fixture: 9% of the two armies' 6,200. */
const HOMECOMING = "558 troops";

/** A row of a list: its painting, its line, and its one verb where it has one; a done row is checked and quiet. */
const Line = ({
  icon,
  line,
  verb,
  done = false,
}: {
  icon: IconMeaning;
  line: string;
  verb?: string;
  done?: boolean;
}) => (
  <div className={`flex items-center gap-2 py-0.5 ${done ? "opacity-60" : ""}`}>
    <Icon name={done ? "check" : icon} size={28} />
    <span className="min-w-0 flex-1 text-hud-body text-hud-ink">{line}</span>
    {verb && (
      <HudButton kind="secondary" size="sm" onClick={noop}>
        {verb}
      </HudButton>
    )}
  </div>
);

/** What the player can still do before the day ends, each with its verb: the one list Today and day end share. */
const BeforeItEnds = () => (
  <div className="flex flex-col">
    <Line icon="labor" line={WORDS.day.claim} verb={WORDS.day.claimVerb} />
    <Line icon="chest" line={WORDS.day.chest} verb={WORDS.day.chestVerb} />
    <Line icon="stamina" line={WORDS.day.stamina} verb={WORDS.day.staminaVerb} />
  </div>
);

/** What the day's end takes and what the realm keeps, side by side, with Homecoming under them. */
const GoneAndKept = () => (
  <>
    <div className="grid grid-cols-2 gap-2">
      <Column tone="warn" title={WORDS.day.gone} lines={WORDS.day.goneList} />
      <Column title={WORDS.day.kept} lines={WORDS.day.keptList} />
    </div>
    <Line icon="home" line={comesHomeAtDayEnd(HOMECOMING)} />
  </>
);

const Column = ({
  tone,
  title,
  lines,
}: {
  tone?: "warn";
  title: string;
  lines: readonly { icon: IconMeaning; line: string }[];
}) => (
  <div
    className={`flex flex-col gap-1 rounded-lg border p-2 ${tone === "warn" ? "border-hud-bad" : "border-white/10"}`}
  >
    <span className="text-hud-label">{title}</span>
    {lines.map(({ icon, line }) => (
      <span key={line} className="flex items-center gap-1.5 text-hud-body text-hud-ink">
        <Icon name={icon} size={22} />
        {line}
      </span>
    ))}
  </div>
);

/** Day end A: the last hour's card in the notices band: what ends, what comes home, what is left to do. */
const LastHourCard = () => (
  <HudPanel label={WORDS.day.endsIn("42m")} title={WORDS.day.endsIn("42m")} icon="hourglass" collapsible={false}>
    <div className="flex flex-col">
      <Line icon="map-army" line={`${WORDS.day.goneList[0].line}, ${WORDS.day.goneList[1].line.toLowerCase()}: gone`} />
      <Line icon="home" line={comesHomeAtDayEnd(HOMECOMING)} />
      <BeforeItEnds />
    </div>
  </HudPanel>
);

/** Day end B: one line in the notices band from the last hour, its tone rising in the last ten minutes; it opens Today. */
const DayEndsLine = ({ left, final }: { left: string; final: boolean }) => (
  <HudNotice
    tone={final ? "bad" : "warn"}
    icon="hourglass"
    line={`${WORDS.day.endsIn(left)} · ${WORDS.day.toDo(3)}`}
    fix={{ label: WORDS.day.open, onClick: noop }}
  />
);

/** Day end B: Today, from the clock or the line, with the day end's two blocks over its totals. */
const TodayWithDayEnd = () => (
  <HudSheet label={TODAY} onClose={noop}>
    <span className="text-hud-title">Day 12 of 14</span>
    <DayEnds endsAt={DAY_ENDS_AT} secondsLeft={42 * 60} tone="ember" />
    <span className="text-hud-label">{WORDS.day.before}</span>
    <BeforeItEnds />
    <GoneAndKept />
    <DayTotalsGrid totals={{ reveals: 19, cleared: 2, chests: 0, essence: 4_150, labor: 550, lords: 0 }} />
  </HudSheet>
);

/** The fixture's day end, a fixed instant so every still reads the same clock. */
const DAY_ENDS_AT = 1_793_000_400;

/** Day end C: one card, once, ten minutes before the end, with its one way out. */
const FinalCall = () => (
  <Overlay>
    <HudPanel label={WORDS.day.endsIn("9m")} title={WORDS.day.endsIn("9m")} icon="hourglass" collapsible={false}>
      <div className="flex flex-col gap-2">
        <GoneAndKept />
        <span className="text-hud-label">{WORDS.day.before}</span>
        <BeforeItEnds />
        <div className="flex justify-end">
          <HudButton kind="primary" onClick={noop}>
            {WORDS.day.finalVerb}
          </HudButton>
        </div>
      </div>
    </HudPanel>
  </Overlay>
);

/** Next up B: the day's list where Next up stood, done rows checked. */
const TodayList = () => (
  <HudPanel
    label={TODAY}
    title={TODAY}
    icon="calendar"
    collapsible={false}
    cue={<HudChip icons={["hourglass"]}>7h 14m</HudChip>}
  >
    <div className="flex flex-col">
      <Line icon="labor" line={WORDS.next.done} done />
      <Line icon="camp" line={WORDS.next.camp} verb={WORDS.next.campVerb} />
      <Line icon="chest" line={WORDS.day.chest} verb={WORDS.day.chestVerb} />
      <Line icon="stamina" line={WORDS.day.stamina} verb={WORDS.day.staminaVerb} />
    </div>
  </HudPanel>
);

const Overlay = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-[min(26rem,calc(100vw-2rem))]">{children}</div>
  </div>
);

/** Population B: Build pressed on Barracks with every person housed; the Hut is offered, never chosen for the player. */
const PopulationAsk = () => (
  <Overlay>
    <HudConfirm
      question={WORDS.pop.full}
      verb={WORDS.pop.hutHere}
      cancel={WORDS.pop.another}
      onConfirm={noop}
      onCancel={noop}
    >
      <div className="flex items-center gap-3">
        <Icon name="workers-hut" size={64} />
        <div className="flex flex-col items-start gap-1.5">
          <HudChip tone="bad" icons={["person"]} label="Population">
            18 / 18
          </HudChip>
          <span className="flex items-center gap-1.5 text-hud-body text-hud-ink">
            <Icon name="barracks" size={22} />
            {BARRACKS}
            <HudChip icons={["person"]}>3</HudChip>
          </span>
          <span className="flex items-center gap-1.5 text-hud-body text-hud-ink">
            <Icon name="workers-hut" size={22} />
            {HUT}
            <HudChip tone="good" icons={["person"]}>
              +6
            </HudChip>
          </span>
        </div>
      </div>
    </HudConfirm>
  </Overlay>
);

/** What an option puts where Next up stands; undefined keeps Next up as the game draws it today. */
export const clarityNextUp = (mock: ClarityMock | undefined): ReactNode | undefined => {
  if (mock === "next-b") return <TodayList />;
  // Every option but today's (pop-now) is drawn as if Next up were cut, so each still shows its own change alone.
  if (mock !== undefined && mock !== "pop-now") return null;
  return undefined;
};

/** What an option shows in the HUD's notices band. */
export const clarityNotices = (mock: ClarityMock | undefined): ReactNode => {
  if (mock === "pop-c")
    return (
      <HudNotice tone="warn" icon="person" line={WORDS.pop.alert} fix={{ label: WORDS.pop.alertVerb, onClick: noop }} />
    );
  if (mock === "day-a") return <LastHourCard />;
  if (mock === "day-b-final") return <DayEndsLine left="9m" final />;
  return null;
};

/** What an option opens over the HUD: a sheet or a card. */
export const ClarityOverlay = ({ mock }: { mock: ClarityMock | undefined }) => {
  if (mock === "pop-b") return <PopulationAsk />;
  if (mock === "day-b") return <TodayWithDayEnd />;
  if (mock === "day-c") return <FinalCall />;
  return null;
};

/**
 * The build sheet each population option opens, as the lab hands it to BuildView: the card chosen (today, the Hut Next
 * up asked for; otherwise the player's Barracks), and whether its foot refuses with the Hut's way past or offers Build.
 */
export const clarityBuild = (mock: ClarityMock) =>
  mock === "pop-now"
    ? { chosen: "hut", foot: "build", fixWord: undefined }
    : mock === "pop-a"
      ? { chosen: "barracks", foot: "refuse", fixWord: WORDS.pop.hutHere }
      : mock === "pop-b"
        ? { chosen: "barracks", foot: "build", fixWord: undefined }
        : undefined;
