import "@/ui/design-system/kit/app-sheet.css";

import {
  AppButton,
  AppChip,
  AppChoice,
  AppDialog,
  AppEmpty,
  AppField,
  AppFigure,
  AppGameCard,
  AppIconButton,
  AppKey,
  AppNav,
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
} from "@/ui/design-system/kit/app-elements";
import { Button } from "@/ui/design-system/kit/button";
import { Field } from "@/ui/design-system/kit/field";
import { Figure } from "@/ui/design-system/kit/figure";
import { Kbd } from "@/ui/design-system/kit/kbd";
import { ListRow, RowThumb } from "@/ui/design-system/kit/list-row";
import { Notice } from "@/ui/design-system/kit/notice";
import { PaintedCard } from "@/ui/design-system/kit/painted-card";
import { Panel } from "@/ui/design-system/kit/panel";
import { Pill } from "@/ui/design-system/kit/pill";
import { Portrait } from "@/ui/design-system/kit/portrait";
import { SettingRow, SettingRows } from "@/ui/design-system/kit/setting-row";
import { Switch } from "@/ui/design-system/kit/switch";
import { Title } from "@/ui/design-system/kit/title";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import { APP_SHEET, APP_TYPE, HUD_MODES, TYPE } from "@/tokens";
import { type ReactNode, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Element } from "../sheet-element";
import { PLACES } from "./app-blocks";
import { DIRECTION_PAGES, DIRECTIONS, type DirectionKey, type DirectionPage, PAGE_NAMES } from "./app-directions";
import { AGE_OF, PLAYER } from "./app-lab-data";
import { APP_SPEC } from "./app-spec";

/**
 * Dev only: the app's style sheet at /lab/kit/app: its spec (one line per page), the app scope of the token file
 * (src/tokens.ts APP_TYPE, APP_SHEET), every element built from it in every state beside what the app draws today, and
 * the three desktop directions applied to the four most-used pages. Each direction's page opens alone at 1920×1080 at
 * /lab/kit/app/<direction>/<page>, for the owner and the captures.
 */
export const AppSheetLab = () => (
  <div data-surface="shell" className="min-h-screen bg-[#0d0a08] p-6 font-body">
    <header data-lab-chrome className="mb-6 flex flex-wrap items-center gap-4 text-sm text-white/80">
      <h1 className="text-xl font-bold text-white">App style sheet</h1>
      <span>
        The app's spec, its scope of src/tokens.ts, every element in every state, and three desktop directions.
      </span>
      <nav className="ml-auto flex gap-3 underline">
        <a href="#directions">Directions</a>
        <Link to="/lab/kit">HUD sheet</Link>
        <Link to="/lab/kit/shell">Shell kit</Link>
        <Link to="/lab/kit/tokens">Tokens</Link>
        <Link to="/lab/app/home">App pages today</Link>
      </nav>
    </header>
    <main className="flex flex-col gap-6">
      <SpecSection />
      <TypeSection />
      <ColourSection />
      <ButtonSection />
      <FieldSection />
      <NavSection />
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
      <DirectionsSection />
    </main>
  </div>
);

/** One direction's page alone, at the desktop's 1920×1080. */
export const AppDirectionPage = () => {
  const { direction, page } = useParams();
  const chosen = DIRECTIONS[direction as DirectionKey];
  if (!chosen || !DIRECTION_PAGES.includes(page as DirectionPage)) return <p>Unknown direction or page.</p>;
  return <div data-lab="app-direction">{chosen.pages[page as DirectionPage]()}</div>;
};

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
              <span className="text-app-label text-[rgb(var(--app-age))]">Age {AGE_OF[age].numeral}</span>
              <span className="text-app-title text-app-ink">{AGE_OF[age].name}</span>
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
    todayLabel={TODAY}
    rule="Primary is the page's one verb (large where it leads the page, with Enter beside it on a desktop), secondary sits beside it, quiet is a way out; a loss is said in the bad tone."
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
                icon={kind === "primary" ? "play" : undefined}
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
        <StateRow
          label="icon"
          render={(state) => (
            <AppIconButton icon="share" label="Share" data-state={forced(state)} disabled={state === "disabled"} />
          )}
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AppButton kind="primary" size="lg" icon="play" keyHint="Enter">
            Pay and join
          </AppButton>
          <AppButton kind="primary" busy="Joining…">
            Pay and join
          </AppButton>
          <AppKey>Esc</AppKey>
        </div>
      </>
    }
    today={
      <>
        <Button role="primary" word="Resume" icon="play" />
        <Button role="secondary" word="Join" icon="play" />
        <Button role="outline" word="Later" />
        <Button role="outline" word="Sign out" />
        <Kbd keyName="Enter" />
      </>
    }
  />
);

const FieldSection = () => (
  <Element
    name="Field"
    todayLabel={TODAY}
    rule="Its label above, its value in the well, one line under it: a hint, or what is wrong in the bad tone."
    sheet={
      <div className="grid grid-cols-2 gap-4">
        <AppField label="Email" icon="mail" placeholder="you@mail.com" hint="We send a six-digit code." />
        <AppField label="Email" icon="mail" defaultValue="maelis@" error="That is not an email address." />
        <AppField label="Name" defaultValue="Maelis" />
        <AppField label="Name" defaultValue="Maelis" disabled />
      </div>
    }
    today={
      <div className="flex w-full flex-col gap-2">
        <Field size="lg" icon="mail" placeholder="you@mail.com" />
        <Field size="lg" icon="mail" defaultValue="maelis@" invalid />
      </div>
    }
  />
);

const NavSection = () => (
  <Element
    name="Navigation"
    todayLabel={TODAY}
    rule="The app's three places with their keys; the current one in the accent. A bar across the top, or a rail down the side (direction A)."
    sheet={
      <div className="flex flex-col gap-4">
        <AppNav places={PLACES} current="play" />
        <div className="w-64">
          <AppNav places={PLACES} current="season" orientation="rail" />
        </div>
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
      todayLabel={TODAY}
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
      today={
        <div className="w-full">
          <ViewSwitch
            label="Ages"
            views={[
              { id: "blitz", word: "Blitz" },
              { id: "eternum", word: "Eternum" },
            ]}
            lit="blitz"
            onChange={() => undefined}
            variant="split"
          />
        </div>
      }
    />
  );
};

const PanelSection = () => (
  <Element
    name="Panel"
    todayLabel={TODAY}
    rule="The app's one surface: its name over a rule, a cue at its end, then its body; a list runs to its edges."
    sheet={
      <AppPanel title="Frontier" icon="victory" cue="Day 12">
        <p className="text-app-body text-app-muted">Twelve rows of the season's board.</p>
      </AppPanel>
    }
    today={
      <div className="w-full">
        <Panel icon="victory" title="Frontier" aside={<span className="text-sm">Day 12</span>}>
          <p className="text-sm">Twelve rows of the season's board.</p>
        </Panel>
      </div>
    }
  />
);

const GameCardSection = () => (
  <Element
    name="Game card"
    wide
    todayLabel={TODAY}
    rule="A game on its age's painting and in its age's accent: its title, what stands, its one verb. The lead carries the page's gold verb; the rest sit among others."
    sheet={
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-4">
        <AppGameCard
          age="frontier"
          painting="frontier-mist"
          size="lead"
          eyebrow="Age II · Now"
          title="Frontier"
          facts={
            <>
              <AppChip tone="gold">Your realm</AppChip>
              <AppChip icon="hourglass">Day 12 · 7h 14m left</AppChip>
            </>
          }
          verb={
            <AppButton kind="primary" size="lg" icon="play" keyHint="Enter">
              Resume
            </AppButton>
          }
        />
        <AppGameCard
          age="blitz"
          painting="blitz-spires"
          eyebrow="Age I"
          title="Blitz 16:30"
          facts={<AppChip tone="warn">Entry closes in 2h 4m</AppChip>}
          verb={<AppButton kind="secondary">Join</AppButton>}
        />
        <AppGameCard
          age="eternum"
          painting="eternum-restoration"
          eyebrow="Age III"
          title="Eternum"
          facts={<AppChip>Opens in 6 days</AppChip>}
        />
      </div>
    }
    today={
      <div className="w-[34rem]">
        <PaintedCard painting="frontier-mist" sizes="34rem" grade="side" className="flex flex-col gap-3 p-4">
          <Title level="card" as="p">
            Frontier
          </Title>
          <Pill icon="hourglass">Day ends 21:12 · 7h 14m left</Pill>
          <Button role="primary" word="Resume" icon="play" />
        </PaintedCard>
      </div>
    }
  />
);

const RowSection = () => (
  <Element
    name="Row"
    todayLabel={TODAY}
    rule="One thing of a list: its lead (a painting, a rank, a portrait), its words, then its figures or its own button. The player's own row lit; a row that opens something lights on hover."
    sheet={
      <div className="overflow-hidden rounded-[var(--app-radius-panel)] border border-app-line bg-app-surface">
        <AppRow
          lead={
            <img
              alt=""
              src="/images/landscapes/blitz-spires-800.webp"
              className="size-12 rounded-[var(--app-radius-control)] object-cover"
            />
          }
          title="Blitz 16:30"
          detail="Entry closes 16:30 · 2h 4m left · 31 registered"
          trail={
            <>
              <AppChip tone="warn">Entry open</AppChip>
              <AppButton kind="secondary">Join</AppButton>
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
              <span className="text-app-muted">148 sites</span>
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
              <span className="text-app-muted">88 sites</span>
              <AppChip icon="lords" tone="gold">
                1,500
              </AppChip>
            </>
          }
        />
      </div>
    }
    today={
      <ul className="plate w-full px-3">
        <ListRow
          as="li"
          gap={3}
          lead={<RowThumb painting="blitz-spires" size={12} />}
          title="Blitz 16:30"
          line={<span className="font-body text-sm text-kit-muted">Entry closes 16:30 · 2h 4m left</span>}
          spaced
          trailing={<Button role="secondary" word="Join" />}
          className="py-3"
        />
        <ListRow as="li" height={12} gap={3} own="lit" className="px-1">
          <span className="w-8 text-right font-body text-base font-bold tabular-nums text-kit-cream">12</span>
          <span className="min-w-0 flex-1">You</span>
        </ListRow>
      </ul>
    }
  />
);

const ChipFigureSection = () => (
  <Element
    name="Chip and figure"
    todayLabel={TODAY}
    rule="A chip is a state in its tone, a count or an amount with its painting; a figure is the point of its panel with what it counts under it."
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
          <AppChip icon="person">24/24</AppChip>
          <AppChip>Ended</AppChip>
        </div>
        <div className="flex flex-wrap gap-10">
          <AppFigure value="2:03:57" label="Entry closes in" />
          <AppFigure value="#12" label="of 1,240" tone="gold" />
          <AppFigure value="+36" label="rating" tone="good" />
        </div>
      </div>
    }
    today={
      <>
        <Pill icon="hourglass">Starts 16:30 · in 2h 4m</Pill>
        <Pill tone="sage">Live</Pill>
        <Figure size="figure" tone="gold" weight="extrabold" className="leading-none">
          31
        </Figure>
        <Title level="countdown" as="p">
          2:03:57
        </Title>
      </>
    }
  />
);

const NoticeSection = () => (
  <Element
    name="Notice"
    todayLabel={TODAY}
    rule="What the page must say, in its tone, why under it, and Try again where trying again helps."
    sheet={
      <div className="flex flex-col gap-3">
        <AppNotice tone="bad" line="You are offline." why="The last values stay on screen." retry={() => undefined} />
        <AppNotice tone="warn" line="Link a payout wallet to join a paid Blitz." />
        <AppNotice line="Realms on your home screen: install it for one tap." />
      </div>
    }
    today={
      <div className="flex w-full flex-col gap-2">
        <Notice icon="network-off" line="Offline" verb="Try again" onVerb={() => undefined} ember />
        <Notice
          icon="download"
          line="Realms on your home screen"
          verb="Install"
          onVerb={() => undefined}
          onLater={() => undefined}
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
      todayLabel={TODAY}
      rule="A setting: its painting, its name, what it holds, then its control: a switch, or a chevron that opens it."
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
      today={
        <div className="w-full">
          <SettingRows>
            <SettingRow icon="person" name="Name" value="Maelis" onOpen={() => undefined} />
            <SettingRow
              icon="music"
              name="Music"
              end={<Switch on={false} label="Music" onToggle={() => undefined} />}
            />
          </SettingRows>
        </div>
      }
    />
  );
};

const ChoiceSection = () => (
  <Element
    name="Choice"
    todayLabel={TODAY}
    rule="A choice among a few, as tiles: its painting, name, what it does and its price; the chosen one in the gold, ticked."
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
    todayLabel={TODAY}
    rule="Back to where the page came from (Esc on a desktop), its title, and what it does at its end."
    sheet={<AppPageHead title="Settings" back={() => undefined} aside={<AppChip>Signed in with Discord</AppChip>} />}
    today={
      <Title level="page" as="p" shadow="title">
        Settings
      </Title>
    }
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
        <AppPanel title="Season" icon="victory">
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

/** Each direction's four pages, scaled to fit, each opening alone at 1920×1080. */
const DirectionsSection = () => (
  <section id="directions" className="flex flex-col gap-6 rounded-lg border border-white/10 bg-black/20 p-4">
    <header data-lab-chrome className="flex flex-col gap-1">
      <h2 className="text-lg font-bold text-white">Desktop directions</h2>
      <p className="text-sm text-white/60">
        Three directions for the whole app at 1920×1080, each on the four most-used pages, built from the same elements.
        Open a page to see it at full size.
      </p>
    </header>
    {(Object.keys(DIRECTIONS) as DirectionKey[]).map((key) => (
      <div key={key} className="flex flex-col gap-3">
        <div data-lab-chrome>
          <h3 className="text-base font-bold text-white">{DIRECTIONS[key].name}</h3>
          <p className="text-sm text-white/60">{DIRECTIONS[key].idea}</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {DIRECTION_PAGES.map((page) => (
            <Link key={page} to={`/lab/kit/app/${key}/${page}`} className="flex flex-col gap-1">
              <div className="h-[216px] w-[384px] overflow-hidden rounded border border-white/15">
                <div className="origin-top-left scale-[0.2]">{DIRECTIONS[key].pages[page]()}</div>
              </div>
              <span data-lab-chrome className="text-xs text-white/70">
                {PAGE_NAMES[page]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    ))}
  </section>
);
