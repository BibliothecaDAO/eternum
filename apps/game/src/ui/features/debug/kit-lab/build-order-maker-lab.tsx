import type { IconMeaning } from "@/ui/design-system/icon";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudIconButton, HudMeter, HudTabs, HudWindow } from "@/ui/design-system/kit/hud-elements";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Dev only: the build order maker's options for the owner's pick, one frame at a time for its still, at
 * /lab/kit/build-order-maker?option=a|b|c&frame=make|pick|test. Every figure is a fixture: the dry run's times are what
 * its simulator would compute, drawn to show the screen, not measured.
 */
export const BuildOrderMakerLab = () => {
  const [params] = useSearchParams();
  const option = (params.get("option") ?? "b") as Option;
  const frame = (params.get("frame") ?? "make") as Frame;
  const Draw = FRAMES[option]?.[frame];
  return (
    <div className="ui flex min-h-screen flex-col items-center gap-3 bg-hud-well px-4 py-4">
      <p className="text-hud-label text-hud-muted" data-lab="maker-caption">
        Option {option.toUpperCase()} · {OPTION_NAMES[option]} · {FRAME_NAMES[frame]}
      </p>
      <div className="flex w-full justify-center [&_.ui-window]:max-w-full" data-lab="maker-frame">
        {Draw ? <Draw /> : <p>No such frame.</p>}
      </div>
    </div>
  );
};

type Option = "a" | "b" | "c";
type Frame = "make" | "pick" | "test";

const OPTION_NAMES: Record<Option, string> = {
  a: "Write it as text",
  b: "Step cards and a dry run",
  c: "Step cards with the automation plan",
};
const FRAME_NAMES: Record<Frame, string> = { make: "1 · make", pick: "2 · save and pick", test: "3 · test" };

const noop = () => undefined;

/** The goals an order counts, each with its painting: the order language's, the army step being Deploy. */
const GOALS: { goal: string; word: string; icon: IconMeaning }[] = [
  { goal: "farm", word: "Farm", icon: "farm" },
  { goal: "wood", word: "Wood camp", icon: "wood" },
  { goal: "coal", word: "Coal mine", icon: "coal" },
  { goal: "copper", word: "Copper mine", icon: "copper" },
  { goal: "hut", word: "Worker hut", icon: "workers-hut" },
  { goal: "military", word: "Barracks", icon: "barracks" },
  { goal: "army", word: "Deploy army", icon: "deploy" },
];
const ICON_OF = Object.fromEntries(GOALS.map(({ goal, icon }) => [goal, icon])) as Record<string, IconMeaning>;
const WORD_OF = Object.fromEntries(GOALS.map(({ goal, word }) => [goal, word])) as Record<string, string>;

const RANKS = ["Settlement", "City", "Kingdom", "Empire"] as const;

/** A player's order, as written. */
const COAL_RUSH_TEXT = `Name: Coal rush
Settlement:
2 farm
City:
2 coal
2 copper
4 farm
2 wood
1 military
1 army
Kingdom:
8 farm
4 coal
4 copper`;

const CITY_STEPS = [
  { goal: "coal", count: 2 },
  { goal: "copper", count: 2 },
  { goal: "farm", count: 4 },
  { goal: "wood", count: 2 },
  { goal: "military", count: 1 },
  { goal: "army", count: 1 },
];

/** The dry run on a fresh Blitz realm: when each step lands, and what held it. Fixture times. */
const DRY_RUN: { at: string; step: string; icon: IconMeaning; wait?: string }[] = [
  { at: "0:40", step: "2 Farm", icon: "farm" },
  { at: "2:10", step: "Level up to City", icon: "upgrade" },
  { at: "3:05", step: "2 Coal mine", icon: "coal" },
  { at: "4:20", step: "2 Copper mine", icon: "copper", wait: "waited 0:45 for wood" },
  { at: "5:55", step: "4 Farm", icon: "farm" },
  { at: "6:40", step: "Worker hut", icon: "workers-hut", wait: "population 12 of 12" },
  { at: "7:30", step: "2 Wood camp", icon: "wood" },
  { at: "8:50", step: "Barracks (Paladin)", icon: "barracks" },
  { at: "11:20", step: "Level up to Kingdom", icon: "upgrade" },
  { at: "19:40", step: "Deploy army: 7,500 Paladin T1", icon: "deploy", wait: "troops trained by automation" },
];

/** The order as text, each line numbered, a line that does not read marked with its reason. */
const TextOrder = ({ text, bad }: { text: string; bad?: { line: number; why: string } }) => (
  <div className="flex flex-col gap-1">
    <ol className="max-h-[360px] overflow-auto rounded-md border border-hud-line bg-hud-well px-2 py-1.5 font-mono text-[13px] leading-5">
      {text.split("\n").map((line, index) => (
        <li key={index} className={`flex gap-3 ${bad?.line === index + 1 ? "text-hud-bad" : "text-hud-ink"}`}>
          <span className="w-5 shrink-0 text-right text-hud-muted">{index + 1}</span>
          <span className="whitespace-pre">{line}</span>
        </li>
      ))}
    </ol>
    {bad ? (
      <p className="text-hud-label text-hud-bad">
        Line {bad.line}: {bad.why}
      </p>
    ) : (
      <p className="text-hud-label text-hud-good">Reads: 11 steps across Settlement, City and Kingdom.</p>
    )}
  </div>
);

const Foot = ({ children }: { children: ReactNode }) => (
  <div className="mt-3 flex items-center justify-between gap-2 border-t border-hud-divider pt-3">{children}</div>
);

/** A's maker: the text players already share, checked line by line as it is typed. */
const TextMaker = () => (
  <HudWindow title="Build order · Coal rush" icon="book" size="task" onClose={noop}>
    <TextOrder
      text={COAL_RUSH_TEXT.replace("2 copper", "2 coper")}
      bad={{ line: 6, why: "“coper” is not a goal: farm, wood, coal, copper, hut, military or army." }}
    />
    <p className="mt-2 text-hud-label text-hud-muted">
      One step a line, “2 farm”, under the rank it starts at. Level-ups and worker huts need no line.
    </p>
    <Foot>
      <HudButton kind="secondary" size="sm" icon="copy">
        Copy text
      </HudButton>
      <HudButton kind="primary" size="sm" disabled>
        Save to account
      </HudButton>
    </Foot>
  </HudWindow>
);

/** One saved order in the list: its name, its reach, whether it is the active one, and its verbs. */
const OrderRow = ({
  name,
  line,
  active,
  own = true,
}: {
  name: string;
  line: string;
  active?: boolean;
  own?: boolean;
}) => (
  <div
    className="flex items-center gap-3 rounded-md border border-hud-line px-3 py-2"
    data-active={active || undefined}
  >
    <Icon name={active ? "star" : "book"} size={22} />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-hud-strong text-hud-ink">{name}</span>
      <span className="text-hud-label text-hud-muted">{line}</span>
    </span>
    {active ? (
      <HudChip tone="good">Active</HudChip>
    ) : (
      <HudButton kind="secondary" size="sm">
        Use
      </HudButton>
    )}
    {own ? (
      <HudIconButton icon="edit" label="Edit" kind="quiet" size="sm" />
    ) : (
      <HudIconButton icon="copy" label="Copy to edit" kind="quiet" size="sm" />
    )}
  </div>
);

/** Saving and picking, the same in every option: the orders on the account, one active for every Blitz. */
const PickOrders = ({ note }: { note: string }) => (
  <HudWindow title="Your build orders" icon="book" size="task" onClose={noop}>
    <div className="flex flex-col gap-2">
      <OrderRow name="Coal rush" line="City by 2:10 · 11 steps · edited today" active />
      <OrderRow name="Wood first" line="City by 2:40 · 9 steps · edited yesterday" />
      <OrderRow name="Default" line="The game's order · 27 steps" own={false} />
    </div>
    <p className="mt-3 text-hud-label text-hud-muted">{note}</p>
    <Foot>
      <HudButton kind="secondary" size="sm" icon="external-link">
        Paste an order
      </HudButton>
      <HudButton kind="primary" size="sm" icon="plus">
        New order
      </HudButton>
    </Foot>
  </HudWindow>
);

const PICK_NOTE =
  "Saved on your account: the same orders on every device. The active one is what the Build order panel follows in your next Blitz.";

/** A's test: no simulator; the order is tried by playing it, the panel following it in a game. */
const PlayItTest = () => (
  <HudWindow title="Build order · Coal rush" icon="book" size="task" onClose={noop}>
    <div className="flex flex-col gap-2">
      <p className="text-hud-body text-hud-ink">
        Try it in a game: the Build order panel follows it from your next Blitz.
      </p>
      <div className="rounded-md border border-hud-line p-3">
        <p className="text-hud-label text-hud-muted">Build order · Coal rush</p>
        <div className="mt-2 flex items-center gap-3">
          <Icon name="coal" size={28} />
          <span className="flex flex-1 flex-col">
            <span className="text-hud-strong text-hud-ink">Egonal</span>
            <span className="text-hud-label text-hud-warn">Coal mines: 0 of 2 built.</span>
          </span>
          <HudButton kind="secondary" size="sm">
            Build
          </HudButton>
        </div>
      </div>
      <p className="text-hud-label text-hud-muted">
        No dry run: what a step costs and when it lands is learned by playing, a game at a time.
      </p>
    </div>
  </HudWindow>
);

/** One step as a card: its painting, its count to reach with − and +, its place in the rank (drag), and ×. */
const StepCard = ({ goal, count, lands }: { goal: string; count: number; lands?: string }) => (
  <div className="flex items-center gap-2 rounded-md border border-hud-line bg-hud-well px-2 py-1.5">
    <Icon name="swap" size={16} className="opacity-50" />
    <Icon name={ICON_OF[goal]} size={30} />
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-hud-strong text-hud-ink">{WORD_OF[goal]}</span>
      {lands && <span className="text-hud-label text-hud-muted">lands {lands}</span>}
    </span>
    {goal === "army" ? (
      <HudChip>a full army</HudChip>
    ) : (
      <span className="flex items-center gap-1">
        <HudIconButton icon="arrow-down" label="One fewer" kind="quiet" size="sm" />
        <span className="w-6 text-center text-hud-strong tabular-nums">{count}</span>
        <HudIconButton icon="arrow-up" label="One more" kind="quiet" size="sm" />
      </span>
    )}
    <HudIconButton icon="close" label="Remove" kind="quiet" size="sm" />
  </div>
);

/** The goals to add to the open rank, one tap each. */
const Palette = () => (
  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
    {GOALS.map(({ goal, word, icon }) => (
      <button
        key={goal}
        type="button"
        className="ui flex flex-col items-center gap-1 rounded-md border border-hud-line px-1 py-1.5 text-hud-label text-hud-ink"
      >
        <Icon name={icon} size={28} />
        <span className="text-center leading-tight">{word}</span>
      </button>
    ))}
  </div>
);

/** The rank strip: each rank's steps in its own tab, City open. */
const RankTabs = () => (
  <HudTabs
    tabs={RANKS.map((rank) => ({
      key: rank,
      label: rank,
      count: rank === "Settlement" ? 1 : rank === "City" ? 6 : rank === "Kingdom" ? 3 : 0,
    }))}
    value="City"
    onChange={noop}
    size="sm"
  />
);

/** B's maker: tap goals into the open rank's cards; the text stays the shared form, copied out or pasted in. */
const CardsMaker = ({ automation = false }: { automation?: boolean }) => (
  <HudWindow title="Build order · Coal rush" icon="book" size="task" onClose={noop}>
    <div className="flex flex-col gap-2">
      <RankTabs />
      <div className="flex flex-col gap-1.5">
        {CITY_STEPS.map((step) => (
          <StepCard key={step.goal} {...step} />
        ))}
      </div>
      {automation && <AutomationPlan />}
      <p className="text-hud-label text-hud-muted">Add to City:</p>
      <Palette />
    </div>
    <Foot>
      <HudButton kind="secondary" size="sm" icon="copy">
        Copy as text
      </HudButton>
      <HudButton kind="primary" size="sm">
        Save to account
      </HudButton>
    </Foot>
  </HudWindow>
);

/** C's addition: the production plan the order sets on the realm when it reaches this rank. */
const PLAN: { icon: IconMeaning; word: string; share: number }[] = [
  { icon: "coal", word: "Coal", share: 35 },
  { icon: "copper", word: "Copper", share: 35 },
  { icon: "wood", word: "Wood", share: 20 },
  { icon: "paladin-t1", word: "Paladin T1", share: 10 },
];
const AutomationPlan = () => (
  <div className="flex flex-col gap-1.5 rounded-md border border-hud-line p-2">
    <p className="flex items-center justify-between text-hud-label text-hud-ink">
      <span>Automation at City</span>
      <HudChip tone="warn">Custom</HudChip>
    </p>
    {PLAN.map(({ icon, word, share }) => (
      <div key={word} className="flex items-center gap-2">
        <Icon name={icon} size={22} />
        <span className="w-24 text-hud-label text-hud-ink">{word}</span>
        <span className="flex-1">
          <HudMeter share={share / 100} label={`${word} ${share}%`} />
        </span>
        <span className="w-10 text-right text-hud-label tabular-nums text-hud-ink">{share}%</span>
      </div>
    ))}
    <p className="text-hud-label text-hud-muted">Set on the realm as it reaches City; Smart again from Kingdom.</p>
  </div>
);

/** B's and C's test: the order played forward on a fresh realm, each step's minute and what it waited for. */
const DryRun = ({ automation = false }: { automation?: boolean }) => (
  <HudWindow title="Dry run · Coal rush" icon="hourglass" size="task" onClose={noop}>
    <div className="flex flex-col gap-2">
      <p className="text-hud-body text-hud-ink">
        A fresh realm in this Blitz's rules, {automation ? "its automation as the order sets it" : "Smart automation"}:
      </p>
      <div className="flex flex-wrap gap-1.5">
        <HudChip icons={["realm-1"]}>City 2:10</HudChip>
        <HudChip icons={["realm-2"]}>Kingdom 11:20</HudChip>
        <HudChip icons={["deploy"]}>Army 19:40</HudChip>
      </div>
      <ol className="flex flex-col gap-1">
        {DRY_RUN.map(({ at, step, icon, wait }) => (
          <li key={step} className="flex items-center gap-2 rounded-md px-1 py-0.5">
            <span className="w-12 shrink-0 text-right text-hud-strong tabular-nums text-hud-ink">{at}</span>
            <Icon name={icon} size={24} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-hud-body text-hud-ink">{step}</span>
              {wait && <span className="text-hud-label text-hud-warn">{wait}</span>}
            </span>
          </li>
        ))}
      </ol>
      {automation && (
        <p className="text-hud-label text-hud-muted">
          With Smart at City instead: army 21:10 (+1:30), Kingdom 11:05 (−0:15).
        </p>
      )}
    </div>
    <Foot>
      <HudButton kind="secondary" size="sm" icon="edit">
        Edit
      </HudButton>
      <HudButton kind="primary" size="sm" icon="star">
        Make active
      </HudButton>
    </Foot>
  </HudWindow>
);

const FRAMES: Record<Option, Record<Frame, () => ReactNode>> = {
  a: { make: TextMaker, pick: () => <PickOrders note={PICK_NOTE} />, test: PlayItTest },
  b: { make: () => <CardsMaker />, pick: () => <PickOrders note={PICK_NOTE} />, test: () => <DryRun /> },
  c: {
    make: () => <CardsMaker automation />,
    pick: () => (
      <PickOrders note={`${PICK_NOTE} An order's automation plan is set on the realm as it reaches each rank.`} />
    ),
    test: () => <DryRun automation />,
  },
};
