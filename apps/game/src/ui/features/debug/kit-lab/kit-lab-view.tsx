import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { ClockLine } from "@/ui/design-system/kit/clock-line";
import { DayDial } from "@/ui/design-system/kit/day-dial";
import { Field } from "@/ui/design-system/kit/field";
import { IconLine } from "@/ui/design-system/kit/icon-line";
import { Kbd } from "@/ui/design-system/kit/kbd";
import { Notice } from "@/ui/design-system/kit/notice";
import { Panel, PanelTitle } from "@/ui/design-system/kit/panel";
import { Pill } from "@/ui/design-system/kit/pill";
import { PriceChip } from "@/ui/design-system/kit/price-chip";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { SectionLabel } from "@/ui/design-system/kit/section-label";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { FailureCard, StateCard } from "@/ui/design-system/kit/state-card";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
import { Switch } from "@/ui/design-system/kit/switch";
import { TierChip } from "@/ui/design-system/kit/tier-chip";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import { OFFLINE, TRY_AGAIN, YOU } from "@/ui/design-system/kit/words";
import { type ReactNode, useState } from "react";
import { Route, Routes } from "react-router-dom";

import { ConstructionLab } from "./construction-lab";
import { IconLab } from "./icon-lab";
import { TokensLab } from "./tokens-lab";
import { Link } from "react-router-dom";

import { HudLab } from "./hud-lab";

const HOUR = 3600;
/** The handoff's one fiction: Day 12, today ends at 21:40 with 7h 14m left, tomorrow lasts 12h. */
const ENDS_AT = new Date(2026, 9, 7, 21, 40).getTime() / 1000;

/**
 * Dev only: the kit's shared components in their states, on the Frontier ground, at /lab/kit, the Frontier screens
 * built on them at /lab/kit/hud/<state>, and the token file drawn out at /lab/kit/tokens. Nothing here reads a game;
 * every value is the handoff's fiction.
 */
export const KitLabView = () => {
  return (
    <Routes>
      <Route path="construction" element={<ConstructionLab />} />
      <Route path="icons" element={<IconLab />} />
      <Route path="tokens" element={<TokensLab />} />
      <Route path="hud/:state" element={<HudLab />} />
      <Route path="*" element={<Components />} />
    </Routes>
  );
};

const Components = () => {
  return (
    <main className="min-h-dvh bg-kit-ground px-4 py-6 font-sans text-kit-cream">
      <div className="mx-auto flex max-w-[390px] flex-col gap-8 lg:max-w-5xl lg:flex-row lg:flex-wrap">
        <Link to="/lab/kit/icons">Facets icon catalog</Link>
        <Link to="/lab/kit/tokens">Design tokens</Link>
        <Link to="/lab/kit/construction">Construction models</Link>
        <ClockSection />
        <StoresSection />
        <ButtonsSection />
        <FieldsSection />
        <ControlsSection />
        <LinesSection />
        <PillsSection />
        <SwitchesSection />
        <LabelsSection />
        <PanelsSection />
        <StateCardsSection />
        <ReasonsSection />
        <NoticesSection />
        <TiersSection />
        <SeasonSection />
        <SheetSection />
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
  <Section title="StoreBar · PriceChip">
    <div className="grid grid-cols-4 gap-2">
      <StoreBar amount={18_250} tone="calm" />
      <StoreBar amount={9_640} limit={18_000} tone="calm" />
      <StoreBar amount={17_580} limit={18_000} tone="amber" />
      <StoreBar amount={18_000} limit={18_000} tone="ember" />
    </div>
    <div className="flex flex-wrap gap-2">
      <PriceChip of="wheat" amount={10_000} />
      <PriceChip of="labor" amount={24_000} />
      <PriceChip of="essence" amount={1_800} />
      <PriceChip of="lords" amount={60} />
      <PriceChip of="xp" amount={400} />
      <PriceChip of="stamina" amount={undefined} />
    </div>
  </Section>
);

const ButtonsSection = () => (
  <Section title="Button">
    <Button role="primary" word="Deploy" prices={[{ of: "wheat", amount: 10_000 }]} />
    <Button role="primary" word="Deploy" loading="Deploying…" />
    <div className="flex gap-2">
      <Button role="outline" word="Cancel" className="w-[104px]" />
      <Button role="primary" word="Explore" prices={[{ of: "stamina", amount: 30 }]} className="flex-1" />
    </div>
    <div className="flex gap-2">
      <Button role="secondary" word="Refill" prices={[{ of: "lords", amount: 60 }]} className="flex-1" />
      <Button role="primary" word="Upgrade" prices={[{ of: "xp", amount: 100 }]} className="flex-1" />
    </div>
    {/* `to`: a verb that leads to a route (Play on an unknown page, a card's Enter). */}
    <Button role="secondary" word="Tokens" icon="play" to="/lab/kit/tokens" />
  </Section>
);

const FieldsSection = () => {
  const [draft, setDraft] = useState("");
  return (
    <Section title="Field">
      <Field
        size="md"
        aria-label="Message"
        placeholder="Message"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        trailing={<Kbd keyName="Enter" className="pointer-events-none max-lg:hidden" />}
      />
      <Field size="lg" icon="mail" type="email" aria-label="Email" placeholder="you@mail.com" />
      <Field size="lg" valid aria-label="Name" defaultValue="Maelis" className="font-body text-xl font-bold" />
      <Field size="lg" invalid aria-label="Name" defaultValue="Ma" className="font-body text-xl font-bold" />
    </Section>
  );
};

const ControlsSection = () => {
  const [music, setMusic] = useState(true);
  const [guide, setGuide] = useState(false);
  return (
    <Section title="Switch · Kbd">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-base">Music</span>
        <Switch on={music} label="Music" onToggle={() => setMusic(!music)} />
      </div>
      <div className="flex items-center gap-3">
        <span className="flex-1 text-base">Guide</span>
        <Switch on={guide} label="Guide" onToggle={() => setGuide(!guide)} />
      </div>
      <div className="flex items-center gap-2">
        {["1", "2", "3", "Esc", "Enter"].map((key) => (
          <Kbd key={key} keyName={key} />
        ))}
      </div>
    </Section>
  );
};

const LinesSection = () => (
  <Section title="IconLine">
    <IconLine tone="cream" icon="lock">
      Your keys stay with you.
    </IconLine>
    <IconLine tone="muted" icon="hourglass">
      Arrives when the season closes.
    </IconLine>
    <IconLine tone="cream" iconSize={22} icon="check">
      Claimed.
    </IconLine>
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
      <Pill size="sm" tone="gold" rimmed icon="chest">
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
    {/* The HUD's amounts stay on its chip token: Chip, PriceChip. */}
    <div className="flex flex-wrap gap-2">
      <Chip icons={["person"]} value="17/24" label="Seats" />
    </div>
  </Section>
);

const SwitchesSection = () => {
  const [board, setBoard] = useState<"frontier" | "blitz">("frontier");
  const [mode, setMode] = useState<"blitz" | "eternum">("blitz");
  return (
    <Section title="ViewSwitch · joined, split">
      <ViewSwitch
        label="Boards"
        views={[
          { id: "frontier", word: "Frontier", icon: "crown" },
          { id: "blitz", word: "Blitz", icon: "attack" },
        ]}
        lit={board}
        onChange={setBoard}
      />
      <ViewSwitch
        label="Modes"
        variant="split"
        semantics="tab"
        views={[
          { id: "blitz", word: "Blitz" },
          { id: "eternum", word: "Eternum" },
        ]}
        lit={mode}
        onChange={setMode}
        marked={["blitz", "eternum"]}
        markWord="Yours"
      />
    </Section>
  );
};

const LabelsSection = () => (
  <Section title="SectionLabel">
    <SectionLabel>Now</SectionLabel>
    <SectionLabel tone="gold" size="body" className="px-2">
      Notifications
    </SectionLabel>
  </Section>
);

const PanelsSection = () => (
  <Section title="Panel · PanelTitle">
    <Panel icon="crown" title="Frontier" aside={<span className="text-kit-gold">12th</span>}>
      <p className="px-1 text-base text-kit-muted">Gilded, on a plate, small padding.</p>
    </Panel>
    <Panel rule="line" pad="lg" icon="chest" title="Chest">
      <p className="text-base text-kit-muted">Line, on a plate, large padding.</p>
    </Panel>
    <div className="plate p-5">
      <Panel
        rule="line"
        surface="bare"
        icon="lords"
        title="Entry"
        aside={
          <Pill tone="muted" icon="backpack">
            0x04a1…9c2e
          </Pill>
        }
      >
        <p className="text-base text-kit-muted">Line, bare, inside a plate.</p>
      </Panel>
    </div>
    <PanelTitle rule="line" icon="backpack">
      Payout wallet
    </PanelTitle>
  </Section>
);

const StateCardsSection = () => (
  <Section title="StateCard · FailureCard">
    <StateCard painting="brooding-plains">
      <p className="font-body text-lg font-bold text-kit-cream">No season running</p>
    </StateCard>
    <StateCard painting="brooding-plains" image="md" pad="4" sizes="50vw">
      <p className="font-body text-xl font-bold text-kit-cream">No season running</p>
    </StateCard>
    <StateCard painting="stormy" image="lg" sizes="100vw">
      <p className="font-body text-lg font-bold text-kit-cream">Nothing here</p>
    </StateCard>
    <FailureCard service="season" error={new Error("lab")} retry={() => undefined} />
  </Section>
);

const ReasonsSection = () => (
  <Section title="ReasonPlate">
    <ReasonPlate
      reason={{ kind: "short", of: "labor", held: 9_640, need: 15_000, wait: 10 * HOUR + 44 * 60 }}
      step={<Button role="primary" word="Map" className="w-[104px]" />}
    />
    <ReasonPlate reason={{ kind: "short", of: "lords", held: 40, need: 60 }} />
    <ReasonPlate
      reason={{ kind: "failed", line: "Season did not answer." }}
      step={<Button role="outline" word={TRY_AGAIN} />}
    />
  </Section>
);

const NoticesSection = () => {
  const [trying, setTrying] = useState(false);
  return (
    <Section title="Notice">
      <Notice
        icon="network-off"
        line={OFFLINE}
        verb={TRY_AGAIN}
        loading={trying ? "Trying…" : undefined}
        onVerb={() => setTrying(true)}
        ember
      />
      <Notice icon="refresh" line="Update ready" verb="Update" onVerb={() => undefined} onLater={() => undefined} />
    </Section>
  );
};

const TiersSection = () => {
  const [view, setView] = useState<"tiers" | "frames">("tiers");
  return (
    <Section title="TierChip · ViewSwitch">
      <ViewSwitch
        label="Tiers"
        views={[
          { id: "tiers", word: "Words" },
          { id: "frames", word: "Frames" },
        ]}
        lit={view}
        onChange={setView}
      />
      <div className="flex flex-wrap gap-2">
        {([1, 2, 3, 4, 5] as const).map((tier) => (
          <TierChip key={tier} tier={tier} showWord={view === "tiers"} />
        ))}
      </div>
    </Section>
  );
};

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
      <Button role="secondary" word="Menu" onClick={() => setOpen(true)} />
      {open && (
        <Sheet label="Menu" onClose={() => setOpen(false)}>
          <p className="frontier-title">Menu</p>
          <div className="flex gap-2">
            <Button role="secondary" word="Exit" className="w-[130px]" />
            <Button role="primary" word="Resume" className="flex-1" onClick={() => setOpen(false)} />
          </div>
        </Sheet>
      )}
    </Section>
  );
};
