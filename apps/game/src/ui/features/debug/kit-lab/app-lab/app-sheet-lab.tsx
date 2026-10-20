import "@/ui/design-system/kit/app-sheet.css";

import {
  AppButton,
  AppChip,
  AppChoice,
  AppCode,
  AppDialog,
  AppEmpty,
  AppField,
  AppFigure,
  AppGameCard,
  AppNotice,
  AppPageHead,
  AppPanel,
  AppPortrait,
  AppRank,
  AppRow,
  AppSetting,
  AppSkeleton,
  AppSwitch,
  AppTabs,
  AppTopBar,
} from "@/ui/design-system/kit/app-elements";
import { Portrait } from "@/ui/design-system/kit/portrait";
import { APP_SHEET, APP_TYPE, HUD_MODES, TYPE } from "@/tokens";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";

import { REWARD_WORDS } from "@/ui/design-system/kit/words";

import { Element } from "../sheet-element";
import { Icon } from "@/ui/design-system/icon";
import { rewardChestMeaning } from "@/ui/design-system/domain-icon-meaning";
import { ageOf } from "@/shell/play/ages";
import { ResearchBoard } from "./app-research-board";
import { APP_SPEC } from "./app-spec";

/**
 * Dev only: the app's style sheet at /lab/kit/app: the research behind it, its spec (one line per page), the app scope of the token file
 * (src/tokens.ts APP_TYPE, APP_SHEET), every element built from it in every state beside what the app draws today, and
 * the four most-used pages in the desktop directions the owner picked. Each page opens alone at 1920×1080 at
 * /lab/kit/app/<page>, for the owner and the captures.
 */
export const AppSheetLab = () => (
  <div data-surface="shell" className="min-h-screen bg-[#0d0a08] p-6 font-body">
    <header data-lab-chrome className="mb-6 flex flex-wrap items-center gap-4 text-sm text-white/80">
      <h1 className="text-xl font-bold text-white">App style sheet</h1>
      <span>The app's spec, its scope of src/tokens.ts, every element in every state, and its pages on a desktop.</span>
      <nav className="ml-auto flex gap-3 underline">
        <a href="#research">Research</a>
        <a href="#pages">Pages</a>
        <Link to="/lab/kit">HUD sheet</Link>
        <Link to="/lab/kit/shell">Shell kit</Link>
        <Link to="/lab/kit/tokens">Tokens</Link>
        <Link to="/lab/app/home">App pages today</Link>
      </nav>
    </header>
    <main className="flex flex-col gap-6">
      <ResearchBoard />
      <SpecSection />
      <TypeSection />
      <ColourSection />
      <ButtonSection />
      <FieldSection />
      <CodeSection />
      <TopBarSection />
      <TabsSection />
      <PanelSection />
      <GameCardSection />
      <RowSection />
      <ChipFigureSection />
      <NoticeSection />
      <SettingSection />
      <ChoiceSection />
      <PortraitSection />
      <PageHeadSection />
      <EmptySection />
      <DialogSection />
      <ChestSection />
      <PagesSection />
    </main>
  </div>
);

/** The player the sheet's samples show. */
const PLAYER = { name: "Maelis", portrait: "/images/avatars/07.png" };

const STATES = ["rest", "hover", "pressed", "focus", "disabled"] as const;
type State = (typeof STATES)[number];
const forced = (state: State) => (state === "rest" || state === "disabled" ? undefined : state);

/** A row of one element drawn in each state the lab can force. */
const StateRow = ({ label, render }: { label: string; render: (state: State) => ReactNode }) => (
  <div className="mb-3 grid grid-cols-[7rem_repeat(5,minmax(0,1fr))] items-center gap-3">
    <span data-lab-chrome className="text-xs text-white/60">
      {label}
    </span>
    {STATES.map((state) => (
      <div key={state} className="flex flex-col items-start gap-1">
        {render(state)}
      </div>
    ))}
  </div>
);

const StateHeads = () => (
  <div data-lab-chrome className="mb-2 grid grid-cols-[7rem_repeat(5,minmax(0,1fr))] gap-3 text-xs text-white/50">
    <span />
    {STATES.map((state) => (
      <span key={state}>{state}</span>
    ))}
  </div>
);

const TODAY = "Today in the app";

const SpecSection = () => (
  <Element
    name="The spec"
    wide
    todayLabel="What it replaces"
    rule="One line per page: what it is for and its one primary action. Fourteen addresses, twelve kinds of page; the merges leave nine and a state."
    sheet={
      <table className="w-full border-collapse text-left text-app-body text-app-ink">
        <thead className="text-app-label text-app-muted">
          <tr>
            {["Page", "Address", "What it is for", "Its one primary action", "Sheet", "Why"].map((head) => (
              <th key={head} className="border-b border-app-line px-3 py-2">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {APP_SPEC.map((page) => (
            <tr key={page.page} className="align-top">
              <td className="border-b border-app-line px-3 py-2 text-app-strong">{page.page}</td>
              <td className="border-b border-app-line px-3 py-2 text-app-label text-app-muted">{page.route}</td>
              <td className="border-b border-app-line px-3 py-2">{page.job}</td>
              <td className="border-b border-app-line px-3 py-2">{page.primary}</td>
              <td className="border-b border-app-line px-3 py-2">
                <AppChip tone={page.verdict === "keep" ? "good" : page.verdict === "merge" ? "warn" : "bad"}>
                  {page.verdict}
                </AppChip>
              </td>
              <td className="border-b border-app-line px-3 py-2 text-app-label text-app-muted">{page.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    }
    today={
      <p className="text-sm text-white/70">
        The shell's comments cite a numbered spec (02–14) that is lost; each line above is read from the page's own
        comment and its code.
      </p>
    }
  />
);

const TYPE_SAMPLES: Record<keyof typeof APP_TYPE, string> = {
  display: "The mist forgets.",
  title: "Season 3",
  heading: "Frontier standings",
  body: "Entry closes 16:30 · 2h 4m left · 31 registered",
  strong: "Resume · 2,900 LORDS",
  label: "Day 12 · 7h 14m left",
  figure: "2:03:57",
};

const TypeSection = () => (
  <Element
    name="Type scale"
    todayLabel={TODAY}
    rule="Seven roles, each a face, a size and a weight: titles in Bokor, everything read in Atkinson, nothing under 14px. An app text takes a role, never a size."
    sheet={
      <div className="flex flex-col gap-3">
        {(Object.keys(APP_TYPE) as (keyof typeof APP_TYPE)[]).map((role) => (
          <div key={role} className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-3">
            <span data-lab-chrome className="font-mono text-xs text-white/60">
              {role} {APP_TYPE[role].size}/{APP_TYPE[role].weight}
            </span>
            <span className={`text-app-${role} text-app-ink`}>{TYPE_SAMPLES[role]}</span>
          </div>
        ))}
      </div>
    }
    today={
      <div className="flex flex-col gap-1">
        <span data-lab-chrome className="text-xs text-white/50">
          Today: TYPE's nine steps named by size, beside Tailwind's own sizes and weights in each page.
        </span>
        {Object.entries(TYPE).map(([step, value]) => (
          <span
            key={step}
            style={{ fontSize: Array.isArray(value) ? value[0] : value }}
            className="leading-tight text-kit-cream"
          >
            {step} · Season 3
          </span>
        ))}
      </div>
    }
  />
);

// Written out so Tailwind generates each class.
const ROLE_CLASSES =
  "text-app-display text-app-title text-app-heading text-app-body text-app-strong text-app-label text-app-figure";
void ROLE_CLASSES;

const COLOUR_ROLES = [
  "ground",
  "surface",
  "surface-2",
  "ink",
  "muted",
  "accent",
  "gold",
  "line",
  "line-strong",
  "good",
  "bad",
  "warn",
] as const;

const swatch = (name: (typeof COLOUR_ROLES)[number]) =>
  name === "accent" || name === "gold" ? `rgb(var(--app-${name}))` : `var(--app-${name})`;

const ColourSection = () => (
  <Element
    name="Colours and ages"
    todayLabel={TODAY}
    rule="Colour by role, the shell's own scope (an app value never moves a HUD pixel). Where the app shows a game, the game wears its age: the HUD's own age colours, one source."
    sheet={
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-6 gap-3">
          {COLOUR_ROLES.map((name) => (
            <div key={name} className="flex flex-col gap-1">
              <span className="h-12 rounded-md border border-white/10" style={{ background: swatch(name) }} />
              <span data-lab-chrome className="font-mono text-xs text-white/60">
                {name}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(HUD_MODES) as (keyof typeof HUD_MODES)[]).map((age) => (
            <div
              key={age}
              data-age={age}
              className="flex flex-col gap-1 rounded-[var(--app-radius-panel)] border border-[rgb(var(--app-age)/0.4)] bg-[linear-gradient(180deg,var(--app-age-from),var(--app-age-to))] p-4"
            >
              <span className="text-app-label text-[rgb(var(--app-age))]">Age {ageOf(age).numeral}</span>
              <span className="text-app-title text-app-ink">{ageOf(age).name}</span>
            </div>
          ))}
        </div>
        <p data-lab-chrome className="font-mono text-xs text-white/50">
          control {APP_SHEET.control} · large {APP_SHEET["control-lg"]} · corners {APP_SHEET["radius-chip"]} /{" "}
          {APP_SHEET["radius-control"]} / {APP_SHEET["radius-panel"]}
        </p>
      </div>
    }
    today={
      <p className="text-sm text-white/70">
        SHELL_COLORS holds the same values as the HUD's palette under the same names (cream, plate, line2), read as
        kit-* classes with opacity modifiers page by page (bg-kit-gold/[.14], text-kit-muted).
      </p>
    }
  />
);

const ButtonSection = () => (
  <Element
    name="Button"
    rule="Primary is the page's one verb (large where it leads the page, with Enter beside it on a desktop), secondary sits beside it, quiet is a way out; a loss is said in the bad tone. A verb takes its icon before its word."
    sheet={
      <>
        <StateHeads />
        {(["primary", "secondary", "quiet"] as const).map((kind) => (
          <StateRow
            key={kind}
            label={kind}
            render={(state) => (
              <AppButton
                kind={kind}
                icon={kind === "primary" ? "play" : kind === "secondary" ? "plus" : undefined}
                data-state={forced(state)}
                disabled={state === "disabled"}
              >
                {kind === "primary" ? "Resume" : kind === "secondary" ? "Join" : "Later"}
              </AppButton>
            )}
          />
        ))}
        <StateRow
          label="bad"
          render={(state) => (
            <AppButton kind="secondary" tone="bad" data-state={forced(state)} disabled={state === "disabled"}>
              Sign out
            </AppButton>
          )}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AppButton kind="primary" size="lg" icon="play" step>
            Pay and join
          </AppButton>
          <AppButton kind="primary" busy="Joining…">
            Pay and join
          </AppButton>
        </div>
      </>
    }
  />
);

const CodeSection = () => (
  <Element
    name="Code"
    rule="A code sent by email: six boxes over one real input, the next box lit; a refused code in the bad tone until the player types again."
    sheet={
      <div className="flex flex-col items-start gap-4">
        <AppCode label="Sign-in code" code="48" length={6} refused={false} disabled={false} onType={() => undefined} />
        <AppCode label="Sign-in code" code="" length={6} refused disabled={false} onType={() => undefined} />
        <AppCode label="Sign-in code" code="481927" length={6} refused={false} disabled onType={() => undefined} />
      </div>
    }
  />
);

const FieldSection = () => (
  <Element
    name="Field"
    rule="Its label above, its value in the well, one line under it: a hint, or what is wrong in the bad tone."
    sheet={
      <div className="grid grid-cols-2 gap-4">
        <AppField label="Email" icon="mail" placeholder="you@mail.com" hint="We send a six-digit code." />
        <AppField label="Email" icon="mail" defaultValue="maelis@" error="That is not an email address." />
        <AppField label="Name" defaultValue="Maelis" />
        <AppField label="Name" defaultValue="Maelis" disabled />
      </div>
    }
  />
);

const TopBarSection = () => (
  <Element
    name="Top bar"
    wide
    todayLabel={TODAY}
    rule="The bar across the top of every page, over the page's painting: the mark, Play, Season and What's new with their icons and the current one in the accent; at its right end the LORDS the player holds and the player, who opens You. No key beside a name."
    sheet={
      <div className="flex flex-col gap-3">
        {(["play", "season", "news", "you"] as const).map((current) => (
          <AppTopBar
            key={current}
            mark={<img src="/images/logos/realms-lockup.svg" alt="Realms" className="h-7" />}
            places={[
              { to: "#", label: "Play", icon: "play", current: current === "play" },
              { to: "#", label: "Season", icon: "leaderboard", current: current === "season" },
              { to: "#", label: "What's new", icon: "chronicles", current: current === "news" },
            ]}
            player={{ to: "#", label: PLAYER.name, portrait: PLAYER.portrait, current: current === "you" }}
          />
        ))}
      </div>
    }
    today={
      <p className="text-sm text-white/70">
        The desktop TopBar: Play 1 · Season 2 · You 3 as NavLinks, the current one on gold at 14%; the phone's TabBar at
        the foot in peach.
      </p>
    }
  />
);

const TabsSection = () => {
  const [mode, setMode] = useState<"blitz" | "frontier" | "eternum">("blitz");
  return (
    <Element
      name="Tabs"
      rule="Views of one thing, the chosen one raised; a dot where something of the player's waits."
      sheet={
        <div className="flex flex-col items-start gap-3">
          <AppTabs
            label="Ages"
            value={mode}
            onChange={setMode}
            tabs={[
              { key: "blitz", label: "Blitz", dot: true },
              { key: "frontier", label: "Frontier" },
              { key: "eternum", label: "Eternum" },
            ]}
          />
          <AppTabs
            label="Notifications"
            value="important"
            tabs={[
              { key: "off", label: "Off" },
              { key: "important", label: "Important" },
              { key: "all", label: "All" },
            ]}
          />
        </div>
      }
    />
  );
};

const PanelSection = () => (
  <Element
    name="Panel"
    rule="The app's one surface, translucent over the page's painting: its icon and name over a rule, a cue at its end, then its body; a list runs to its edges. A panel about one game or mode carries that mode's painting in its head."
    sheet={
      <div className="grid grid-cols-2 gap-4">
        <AppPanel title="Season" icon="leaderboard" cue="Day 12">
          <p className="text-app-body text-app-muted">Twelve rows of the season's board.</p>
        </AppPanel>
        <AppPanel title="Frontier" icon="leaderboard" painting="frontier-mist" cue="Day 12">
          <p className="text-app-body text-app-muted">Twelve rows of the season's board.</p>
        </AppPanel>
      </div>
    }
  />
);

const GameCardSection = () => (
  <Element
    name="Game card"
    wide
    rule="A game on its age's painting and in its age's accent: its title, what stands, its one verb. The lead carries the page's gold verb; the rest sit among others."
    sheet={
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-4">
        <AppGameCard
          age="frontier"
          painting="frontier-mist"
          size="lead"
          title="Frontier"
          facts={
            <>
              <AppChip tone="gold">Your realm</AppChip>
              <AppChip icon="hourglass">Day 12 · 7h 14m left</AppChip>
            </>
          }
          verb={
            <AppButton kind="primary" size="lg" icon="play" step>
              Resume
            </AppButton>
          }
        />
        <AppGameCard
          age="blitz"
          painting="blitz-spires"
          title="Blitz 16:30"
          facts={<AppChip tone="warn">Entry closes in 2h 4m</AppChip>}
          verb={
            <AppButton kind="secondary" icon="plus">
              Join
            </AppButton>
          }
        />
        <AppGameCard
          age="eternum"
          painting="eternum-restoration"
          title="Eternum"
          facts={<AppChip>Opens in 6 days</AppChip>}
        />
      </div>
    }
  />
);

const RowSection = () => (
  <Element
    name="Row"
    rule="One thing of a list: its lead (a rank, a portrait), its words, then its figures or its own button. The player's own row lit; a row that opens something lights on hover."
    sheet={
      <div className="overflow-hidden rounded-[var(--app-radius-panel)] border border-app-line bg-app-surface">
        <AppRow
          title="Blitz 16:30"
          detail="Entry closes 16:30 · 2h 4m left · 31 registered"
          trail={
            <>
              <AppChip tone="warn">Entry open</AppChip>
              <AppButton kind="secondary" icon="plus">
                Join
              </AppButton>
            </>
          }
        />
        <AppRow
          lead={
            <>
              <AppRank rank={1} />
              <AppPortrait name="Ysabeau" size="sm" src="/images/avatars/02.png" />
            </>
          }
          title="Ysabeau"
          trail={
            <>
              <AppChip icon="explore">148</AppChip>
              <AppChip icon="lords" tone="gold">
                2,900
              </AppChip>
            </>
          }
          onClick={() => undefined}
        />
        <AppRow
          own
          lead={
            <>
              <AppRank rank={12} />
              <AppPortrait name={PLAYER.name} size="sm" src={PLAYER.portrait} own />
            </>
          }
          title="Maelis · You"
          trail={
            <>
              <AppChip icon="explore">88</AppChip>
              <AppChip icon="lords" tone="gold">
                1,500
              </AppChip>
            </>
          }
        />
      </div>
    }
  />
);

const ChipFigureSection = () => (
  <Element
    name="Chip and figure"
    rule="A chip is a state in its tone, a count, or an amount with its icon; a figure is the point of its panel with what it counts under it. Whatever names a resource, a troop or a rank takes its icon: never a bare number."
    sheet={
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          <AppChip tone="good" live>
            Live
          </AppChip>
          <AppChip tone="warn">Entry closes in 2h 4m</AppChip>
          <AppChip tone="bad">Entry closed</AppChip>
          <AppChip tone="gold" icon="lords">
            2,900
          </AppChip>
          <AppChip icon="people">24/24</AppChip>
          <AppChip icon="wood">1,200</AppChip>
          <AppChip icon="knight-t1">300</AppChip>
          <AppChip icon="rating-conqueror">1,744</AppChip>
          <AppChip>Ended</AppChip>
        </div>
        <div className="flex flex-wrap gap-10">
          <AppFigure icon="hourglass" value="2:03:57" label="Entry closes in" />
          <AppFigure icon="leaderboard" value="#12" label="of 1,240" tone="gold" />
          <AppFigure icon="rating-conqueror" value="+36" label="rating" tone="good" />
          <AppFigure icon="lords" value="6,878" label="LORDS" tone="gold" />
        </div>
      </div>
    }
  />
);

const NoticeSection = () => (
  <Element
    name="Notice"
    rule="What the page must say, in its tone, its icon where one tells it at a glance, why under it, and what to do about it: Try again where trying again helps, a verb and Later."
    sheet={
      <div className="flex flex-col gap-3">
        <AppNotice
          tone="bad"
          icon="network-off"
          line="You are offline."
          why="The last values stay on screen."
          actions={<AppButton kind="secondary">Try again</AppButton>}
        />
        <AppNotice tone="warn" line="Link a payout wallet to join a paid Blitz." />
        <AppNotice
          icon="download"
          line="Realms on your home screen"
          actions={
            <>
              <AppButton kind="quiet">Later</AppButton>
              <AppButton kind="secondary">Install</AppButton>
            </>
          }
        />
      </div>
    }
  />
);

const SettingSection = () => {
  const [music, setMusic] = useState(false);
  return (
    <Element
      name="Setting and switch"
      rule="A setting: its icon, its name, what it holds, then its control: a switch, or a chevron that opens it."
      sheet={
        <div className="overflow-hidden rounded-[var(--app-radius-panel)] border border-app-line bg-app-surface">
          <AppSetting icon="person" name="Name" value="Maelis" onClick={() => undefined} />
          <AppSetting icon="lords" name="Payout wallet" value="Link a wallet" onClick={() => undefined} />
          <AppSetting
            icon="music"
            name="Music"
            control={<AppSwitch label="Music" checked={music} onChange={setMusic} />}
          />
          <AppSetting icon="monitor" name="This device" control={<AppSwitch label="This device" checked disabled />} />
        </div>
      }
    />
  );
};

const ChoiceSection = () => (
  <Element
    name="Choice"
    todayLabel={TODAY}
    rule="A choice among a few, as tiles: its icon, name, what it does and its price; the chosen one ringed in the gold, ticked."
    sheet={
      <div className="flex gap-3">
        <AppChoice icon="flag" title="Seat" detail="Entry" price="500 LORDS" selected />
        <AppChoice icon="attack" title="Sword" detail="Win ×2" price="+ 50 LORDS" />
        <AppChoice icon="defend" title="Shield" detail="Lose ½" price="+ 50 LORDS" disabled />
      </div>
    }
    today={
      <p className="text-sm text-white/70">
        The lobby's Tile: rounded-well border-2, gold when on, a check badge, drawn in entry-panel.tsx alone.
      </p>
    }
  />
);

const PortraitSection = () => (
  <Element
    name="Portrait"
    todayLabel={TODAY}
    rule="A player in a ring; the player's own ring in the accent; an initial where there is no portrait."
    sheet={
      <div className="flex items-center gap-4">
        <AppPortrait name={PLAYER.name} src={PLAYER.portrait} size="lg" own />
        <AppPortrait name="Ysabeau" src="/images/avatars/02.png" />
        <AppPortrait name="Corwin" size="sm" />
      </div>
    }
    today={
      <>
        <Portrait portrait="07" size={96} weight={3} ring="lit" />
        <Portrait portrait="02" size={44} weight={2} />
      </>
    }
  />
);

const PageHeadSection = () => (
  <Element
    name="Page head"
    rule="Back to where the page came from (Esc on a desktop), its title, and what it does at its end."
    sheet={<AppPageHead title="Settings" back="#" aside={<AppChip>Signed in with Discord</AppChip>} />}
  />
);

const EmptySection = () => (
  <Element
    name="Empty and loading"
    todayLabel={TODAY}
    rule="Nothing here, said once with the one step that would fill it; rows standing in for a list that is coming."
    sheet={
      <div className="grid grid-cols-2 gap-4">
        <AppPanel title="Recent games" icon="victory">
          <AppEmpty
            icon="victory"
            line="No finished games yet."
            action={<AppButton kind="secondary">Play</AppButton>}
          />
        </AppPanel>
        <AppPanel title="Season" icon="leaderboard">
          <AppSkeleton rows={4} />
        </AppPanel>
      </div>
    }
    today={
      <p className="text-sm text-white/70">StateCard on a painting, FailureCard, and Loading lines, page by page.</p>
    }
  />
);

const DialogSection = () => (
  <Element
    name="Dialog"
    todayLabel={TODAY}
    rule="A question before what cannot be undone: its title, what it costs, the way out and the verb, the verb last."
    sheet={
      <AppDialog
        title="Sign out?"
        actions={
          <>
            <AppButton kind="quiet">Keep me in</AppButton>
            <AppButton kind="secondary" tone="bad">
              Sign out
            </AppButton>
          </>
        }
      >
        This device forgets its key; signing in again brings it back.
      </AppDialog>
    }
    today={
      <p className="text-sm text-white/70">Confirm in a kit Sheet: the question, the cost, Keep as the gold button.</p>
    }
  />
);

const ChestSection = () => (
  <Element
    name="Reward chest"
    wide
    todayLabel={TODAY}
    rule="A reward is an object: the chest drawn at its rank band's tier, sealed until it is opened, then opened beside what it paid."
    sheet={
      <div className="grid grid-cols-5 gap-4">
        {REWARD_WORDS.band.map((band, index) => (
          <div key={band} className="flex flex-col items-center gap-2">
            <div className="flex">
              <Icon name={rewardChestMeaning(index)} size={128} />
              <Icon name={rewardChestMeaning(index, true)} size={128} />
            </div>
            <AppChip icon="victory">{band}</AppChip>
          </div>
        ))}
      </div>
    }
    today={
      <p className="text-sm text-white/70">
        The reward panel (shell/season-tab/reward-panel.tsx) draws the same reward-chest icons at its band.
      </p>
    }
  />
);

/**
 * The app's real pages on the sheet, over the app lab's fixtures (shell/lab), each in the direction the owner picked:
 * what `pnpm prove:app` captures and checks.
 */
const APP_PAGES = [
  { name: "Play", direction: "B · Ages", path: "/lab/app/home" },
  { name: "Blitz lobby", direction: "C · Ledger", path: "/lab/app/entry-choose/blitz/slot-blitz-1630" },
  { name: "Season", direction: "A · Launcher", path: "/lab/app/season-running/season" },
  {
    name: "Results, the chest sealed",
    direction: "C · Ledger",
    path: "/lab/app/reward-sealed/results/0x5245414c4d53-7",
  },
  {
    name: "Results, the chest opened",
    direction: "C · Ledger",
    path: "/lab/app/reward-lords/results/0x5245414c4d53-7",
  },
] as const;

const PagesSection = () => (
  <section id="pages" className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-4">
    <header data-lab-chrome className="flex flex-col gap-1">
      <h2 className="text-lg font-bold text-white">The app on a desktop</h2>
      <p className="text-sm text-white/60">
        The real pages, drawn from this sheet over the app lab's fixtures, each in the direction the owner picked.
      </p>
    </header>
    <ul className="flex flex-col gap-1 text-sm text-white/80">
      {APP_PAGES.map((page) => (
        <li key={page.path}>
          <Link to={page.path} className="underline">
            {page.name}
          </Link>{" "}
          · {page.direction}
        </li>
      ))}
    </ul>
  </section>
);
