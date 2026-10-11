import { Button } from "@/ui/design-system/kit/button";
import { ClockLine } from "@/ui/design-system/kit/clock-line";
import { DayDial } from "@/ui/design-system/kit/day-dial";
import { Notice } from "@/ui/design-system/kit/notice";
import { PriceChip } from "@/ui/design-system/kit/price-chip";
import { ReasonPlate } from "@/ui/design-system/kit/reason-plate";
import { SeasonRow } from "@/ui/design-system/kit/season-row";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { StoreBar } from "@/ui/design-system/kit/store-bar";
import { TierChip } from "@/ui/design-system/kit/tier-chip";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import { OFFLINE, TRY_AGAIN, YOU } from "@/ui/design-system/kit/words";
import { useFrontierType } from "@/ui/features/frontier/use-frontier-type";
import { useBootDocumentState } from "@/ui/modules/boot-loader/boot-loader-state";
import { type ReactNode, useState } from "react";
import { Route, Routes } from "react-router-dom";

import { HudLab } from "./hud-lab";

const HOUR = 3600;
/** The handoff's one fiction: Day 12, today ends at 21:40 with 7h 14m left, tomorrow lasts 12h. */
const ENDS_AT = new Date(2026, 9, 7, 21, 40).getTime() / 1000;

/**
 * Dev only: the kit's shared components in their states, on the Frontier ground, at /lab/kit, and the Frontier screens
 * built on them at /lab/kit/hud/<state>. Nothing here reads a game; every value is the handoff's fiction.
 */
export const KitLabView = () => {
  useFrontierType();
  useBootDocumentState("app-ready");
  return (
    <Routes>
      <Route path="hud/:state" element={<HudLab />} />
      <Route path="*" element={<Components />} />
    </Routes>
  );
};

const Components = () => {
  return (
    <main className="min-h-dvh bg-kit-ground px-4 py-6 font-sans text-kit-cream">
      <div className="mx-auto flex max-w-[390px] flex-col gap-8 lg:max-w-5xl lg:flex-row lg:flex-wrap">
        <ClockSection />
        <StoresSection />
        <ButtonsSection />
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
    <h2 data-lab-chrome className="text-[13px] text-kit-muted">
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
  </Section>
);

const ReasonsSection = () => (
  <Section title="ReasonPlate">
    <ReasonPlate
      reason={{ kind: "short", icon: "La", held: 9_640, need: 15_000, wait: 10 * HOUR + 44 * 60 }}
      step={<Button role="primary" word="Map" className="w-[104px]" />}
    />
    <ReasonPlate reason={{ kind: "short", icon: "Lo", held: 40, need: 60 }} />
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
        icon="Of"
        line={OFFLINE}
        verb={TRY_AGAIN}
        loading={trying ? "Trying…" : undefined}
        onVerb={() => setTrying(true)}
        ember
      />
      <Notice icon="Sp" line="Update ready" verb="Update" onVerb={() => undefined} onLater={() => undefined} />
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
