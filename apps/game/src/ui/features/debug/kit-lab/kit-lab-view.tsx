import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { ClockChip } from "@/ui/design-system/kit/clock-chip";
import { ClockLine } from "@/ui/design-system/kit/clock-line";
import { DayDial } from "@/ui/design-system/kit/day-dial";
import { ListRow, RowThumb } from "@/ui/design-system/kit/list-row";
import { Pill } from "@/ui/design-system/kit/pill";
import { Portrait } from "@/ui/design-system/kit/portrait";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
import { TierChip } from "@/ui/design-system/kit/tier-chip";
import { YOU } from "@/ui/design-system/kit/words";
import { type ReactNode, useState } from "react";
import { Route, Routes } from "react-router-dom";

import { ConstructionLab } from "./construction-lab";
import { AreaDLab } from "./area-d-lab";
import { DeployLab } from "./deploy-lab";
import { IconLab } from "./icon-lab";
import { TokensLab } from "./tokens-lab";
import { RewardChestsLab } from "./reward-chests-lab";
import { BeastIconsLab } from "./beast-icons-lab";
import { ResourceIconsLab } from "./resource-icons-lab";
import { Link } from "react-router-dom";

import { HudLab } from "./hud-lab";
import { UnifiedHudLab } from "./unified-hud-lab";
import { PanelsLab } from "./panels-lab";
import { BuildOrderLab } from "./build-order-lab";
import { BlitzBuildLab } from "./blitz-build-lab";
import { ProgressionLab } from "./progression/progression-lab";
import { GuidanceLab } from "./guidance-lab";
import { StyleSheetLab } from "./style-sheet-lab";
import { ChatLab } from "./chat-lab";
import { WindowsLab } from "./windows-lab";
import { WordsLab } from "./words-lab";
import { AppArtLab } from "./app-art-lab";
import { AppSheetLab } from "./app-lab/app-sheet-lab";

const HOUR = 3600;
/** The handoff's one fiction: Day 12, today ends at 21:40 with 7h 14m left, tomorrow lasts 12h. */
const ENDS_AT = new Date(2026, 9, 7, 21, 40).getTime() / 1000;

/**
 * Dev only: the HUD's style sheet at /lab/kit (style-sheet-lab.tsx); the shell kit's components in their states, on the
 * Frontier ground, at /lab/kit/shell, the Frontier screens built on them at /lab/kit/hud/<state>, and the token file
 * drawn out at /lab/kit/tokens. Nothing here reads a game; every value is a fixture's.
 */
export const KitLabView = () => {
  return (
    <Routes>
      <Route path="app-art" element={<AppArtLab />} />
      <Route path="construction" element={<ConstructionLab />} />
      <Route path="icons" element={<IconLab />} />
      <Route path="reward-chests" element={<RewardChestsLab />} />
      <Route path="beast-icons" element={<BeastIconsLab />} />
      <Route path="resource-icons" element={<ResourceIconsLab />} />
      <Route path="deploy" element={<DeployLab />} />
      <Route path="area-d" element={<AreaDLab />} />
      <Route path="panels" element={<PanelsLab />} />
      <Route path="windows/:surface?" element={<WindowsLab />} />
      <Route path="guidance" element={<GuidanceLab />} />
      <Route path="build-order" element={<BuildOrderLab />} />
      <Route path="blitz-build" element={<BlitzBuildLab />} />
      <Route path="progression" element={<ProgressionLab />} />
      <Route path="tokens" element={<TokensLab />} />
      <Route path="words" element={<WordsLab />} />
      <Route path="hud/:state" element={<HudLab />} />
      <Route path="unified/:view?" element={<UnifiedHudLab />} />
      <Route path="shell" element={<Components />} />
      <Route path="chat" element={<ChatLab />} />
      <Route path="app" element={<AppSheetLab />} />
      <Route path="*" element={<StyleSheetLab />} />
    </Routes>
  );
};

/** The catalogue draws the kit on the shell's surface (src/tokens.ts SHELL_*); /lab/kit/hud draws it on the HUD's. */
const Components = () => {
  return (
    <main data-surface="shell" className="min-h-dvh bg-kit-ground px-4 py-6 font-sans text-kit-cream">
      <div className="mx-auto flex max-w-[390px] flex-col gap-8 lg:max-w-5xl lg:flex-row lg:flex-wrap">
        <Link to="/lab/kit/icons">Facets icon catalog</Link>
        <Link to="/lab/kit/tokens">Design tokens</Link>
        <Link to="/lab/kit/reward-chests">Reward chest tiers</Link>
        <Link to="/lab/kit/beast-icons">Frontier guard icon review</Link>
        <Link to="/lab/kit/resource-icons">Resource icon review</Link>
        <Link to="/lab/kit/app-art">App background paintings</Link>
        <Link to="/lab/kit/construction">Construction models</Link>
        <ClockSection />
        <StoresSection />
        <PillsSection />
        <TiersSection />
        <SeasonSection />
        <SheetSection />
        <PortraitsSection />
        <ClockChipsSection />
        <ListRowsSection />
      </div>
    </main>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section data-kit-section={title} className="flex w-full flex-col gap-3 lg:w-[390px]">
    <h2 data-lab-chrome className="text-sm text-kit-muted">
      {title}
    </h2>
    {children}
  </section>
);

const PortraitsSection = () => (
  <Section title="Portrait · Portrait.Empty">
    <div className="flex flex-wrap items-center gap-3">
      <Portrait portrait="01" size={96} weight={3} ring="lit" />
      <Portrait portrait="02" size={80} weight={3} />
      <Portrait portrait="03" size={28} weight={1.5} ring="lit" />
      <Portrait portrait="04" size={28} weight={1.5} />
      <Portrait portrait="05" size={24} weight={2} ring="lit" />
      <span className="size-14">
        <Portrait portrait="06" size="fill" weight={2} />
      </span>
      <span className="size-14">
        <Portrait.Empty />
      </span>
      <span className="w-16 overflow-hidden rounded-full border-[3px] border-kit-line opacity-80">
        <Portrait portrait="07" className="aspect-square w-full" />
      </span>
    </div>
  </Section>
);

/** The handoff's "now": 7h 14m before today ends. */
const NOW = ENDS_AT - 7 * HOUR - 14 * 60;

const ClockChipsSection = () => (
  <Section title="ClockChip · countdown">
    <div className="flex flex-wrap gap-2 rounded-control bg-kit-plate2 p-2">
      <ClockChip prefix="ends" at={ENDS_AT} now={NOW} />
      <ClockChip prefix="opens" at={ENDS_AT + 30 * HOUR} now={NOW} />
      <ClockChip prefix={null} at={NOW - 30 * HOUR} now={NOW} />
    </div>
  </Section>
);

const ListRowsSection = () => (
  <Section title="ListRow · SettingRow">
    <ul className="plate px-3">
      <ListRow
        as="li"
        gap={3}
        lead={<RowThumb painting="blitz-spires" size={12} />}
        title="Blitz 1630"
        line={<span className="font-body text-sm text-kit-muted">Starts 16:30 · in 2h 4m</span>}
        spaced
        trailing={
          <HudButton kind="secondary" size="sm">
            Join
          </HudButton>
        }
        className="py-3"
      />
      <ListRow
        as="li"
        to="/lab/kit"
        height={14}
        gap={3}
        lead={<RowThumb painting="frontier-mist" size={10} />}
        title="Frontier 09:00"
        line={<span className="text-sm text-kit-muted">7 Oct</span>}
        className="px-1 py-2"
      >
        <span className="w-12 text-right font-body text-base font-extrabold tabular-nums text-kit-cream">3rd</span>
      </ListRow>
    </ul>
    <ol className="flex flex-col">
      <ListRow as="li" height={12} gap={3} className="px-1">
        <span className="w-8 text-right font-body text-base font-bold tabular-nums text-kit-cream">1</span>
        <span className="min-w-0 flex-1">Ysabeau</span>
      </ListRow>
      <ListRow as="li" height={12} gap={3} own="lit" className="px-1">
        <span className="w-8 text-right font-body text-base font-bold tabular-nums text-kit-cream">12</span>
        <span className="min-w-0 flex-1">{YOU}</span>
      </ListRow>
    </ol>
  </Section>
);

const ClockSection = () => (
  <Section title="DayDial · ClockLine">
    <div className="flex items-center gap-3">
      <DayDial day={12} shareLeft={0.45} tone="calm" />
      <ClockLine endsAt={ENDS_AT} secondsLeft={7 * HOUR + 14 * 60} tomorrowSeconds={12 * HOUR} tone="calm" />
    </div>
    <div className="flex items-center gap-3">
      <DayDial day={12} shareLeft={0.04} tone="ember" />
      <ClockLine endsAt={ENDS_AT} secondsLeft={42 * 60} tomorrowSeconds={12 * HOUR} tone="ember" />
    </div>
    <div className="flex items-center gap-3">
      <DayDial day={undefined} shareLeft={undefined} tone="calm" />
      <ClockLine endsAt={undefined} secondsLeft={undefined} tomorrowSeconds={undefined} tone="calm" />
    </div>
  </Section>
);

const StoresSection = () => (
  <Section title="StoreBar">
    <div className="grid grid-cols-4 gap-2">
      <StoreBar amount={18_250} tone="calm" />
      <StoreBar amount={9_640} limit={18_000} tone="calm" />
      <StoreBar amount={17_580} limit={18_000} tone="amber" />
      <StoreBar amount={18_000} limit={18_000} tone="ember" />
    </div>
  </Section>
);

const PillsSection = () => (
  <Section title="Pill">
    {/* On a painting: a state, a clock, the icon alone, a game under way. */}
    <div className="flex flex-wrap gap-2 rounded-control bg-kit-plate2 p-2">
      <Pill icon="lock">Closed</Pill>
      <Pill icon="hourglass">Starts 16:30 · in 2h 4m</Pill>
      <Pill icon="check" />
      <Pill tone="live">Live</Pill>
    </div>
    {/* On a plate: a credit, a wallet, a step to press, a prize and one that does not come. */}
    <div className="flex flex-wrap items-center gap-2">
      <Pill size="sm" tone="gold" rimmed icon="reward-chest">
        Credit ×2
      </Pill>
      <Pill tone="muted" icon="backpack">
        0x04a1…9c2e
      </Pill>
      <Pill as="button" size="lg" tone="muted" icon="refresh" onClick={() => undefined}>
        Another wallet
      </Pill>
      <Pill size="lg" tone="gold" icon="lords">
        2,000 LORDS
      </Pill>
      <Pill size="lg" tone="sage" icon="check">
        In your collection
      </Pill>
      <Pill size="lg" tone="muted" icon="lords" struck>
        No LORDS
      </Pill>
    </div>
  </Section>
);

const TiersSection = () => (
  <Section title="TierChip">
    <div className="flex flex-wrap gap-2">
      {([1, 2, 3, 4, 5] as const).map((tier) => (
        <TierChip key={tier} tier={tier} showWord />
      ))}
    </div>
  </Section>
);

const STANDINGS = [
  { name: "Ysabeau", order: 1, sites: 148, lords: 704 },
  { name: "Aldric", order: 2, sites: 132, lords: 640 },
  { name: "Corwin", order: 3, sites: 127, lords: 576 },
];

const SeasonSection = () => (
  <Section title="SeasonRow · OrderEmblem">
    <div className="flex flex-col">
      {STANDINGS.map((row, index) => (
        <SeasonRow
          key={row.name}
          rank={index + 1}
          order={row.order}
          name={row.name}
          sitesCleared={row.sites}
          lords={row.lords}
          onOpen={() => undefined}
        />
      ))}
      <SeasonRow rank={12} order={6} name={YOU} sitesCleared={88} lords={192} own onOpen={() => undefined} />
      <SeasonRow
        rank={undefined}
        order={7}
        name="Osric"
        sitesCleared={undefined}
        lords={undefined}
        onOpen={() => undefined}
      />
    </div>
  </Section>
);

const SheetSection = () => {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Sheet">
      <HudButton kind="secondary" onClick={() => setOpen(true)}>
        Menu
      </HudButton>
      {open && (
        <Sheet label="Menu" onClose={() => setOpen(false)}>
          <p className="frontier-title">Menu</p>
          <div className="flex gap-2">
            <HudButton kind="secondary">Exit</HudButton>
            <HudButton kind="primary" onClick={() => setOpen(false)}>
              Resume
            </HudButton>
          </div>
        </Sheet>
      )}
    </Section>
  );
};
