import { GameProvider } from "@/hooks/context/game-context";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useDocumentClass } from "@/hooks/use-document-class";
import AtomButton from "@/ui/design-system/atoms/button";
import { HUD_PILL_BUTTON, OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { Tabs as AtomTabs } from "@/ui/design-system/atoms/tab";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Button as KitButton } from "@/ui/design-system/kit/button";
import { Chip as KitChip } from "@/ui/design-system/kit/chip";
import { TipLine } from "@/ui/design-system/kit/named-tips";
import { PriceChip } from "@/ui/design-system/kit/price-chip";
import { TierChip as KitTierChip } from "@/ui/design-system/kit/tier-chip";
import { TroopTierChip } from "@/ui/design-system/kit/troop-tier-chip";
import { ViewSwitch } from "@/ui/design-system/kit/view-switch";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { HudTabStrip } from "@/ui/design-system/molecules/hud-tab-strip";
import { SurfaceFrame } from "@/ui/design-system/molecules/popover";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";
import {
  HudAmountField,
  HudButton,
  HudChip,
  HudEventRow,
  HudIconButton,
  HudMinimapFrame,
  HudPanel,
  HudRing,
  HudRow,
  HudTabs,
  HudTierChip,
  HudTip,
  HudWindow,
} from "@/ui/design-system/kit/hud-elements";
import { HUD_DERIVED, HUD_MODES, HUD_SHEET, HUD_TYPE, type HudMode } from "@/tokens";
import { FeedRowLine } from "@/ui/features/event-feed/feed-row-line";
import { TroopAmount } from "@/ui/features/military/components/unified-army-creation-modal/troop-amount";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import { HoldingsList, useHoldings } from "@/ui/features/world/hud/holdings";
import { Medallion } from "@/ui/features/world/hud/medallion";
import { ProductionStatusBadge } from "@/ui/shared";
import { Pin, Plate } from "@/three/map-plates/map-plates";
import type { ArmyPlate, StructurePlate } from "@/three/map-plates/map-plate-model";
import "@/three/map-plates/map-plates.css";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import { createContext, type ReactNode, useContext, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { eventsRows, installFixtureGame, PLAYER } from "./fixture-game";

const STATES = ["rest", "hover", "pressed", "focus", "disabled"] as const;

type Device = "desktop" | "phone";
/** Which device the lab draws the sheet for: on a phone, the sheet's column alone, at a phone's width and sizes. */
const DeviceContext = createContext<Device>("desktop");
type State = (typeof STATES)[number];

/**
 * Dev only: the HUD's style sheet at /lab/kit: the HUD scope of the token file (src/tokens.ts), editable here, its type
 * scale first, then every element built from it in every state, in each game mode and on a phone, each beside the
 * versions the game draws today. The owner iterates on the sheet here; the game takes it once approved.
 */
export const StyleSheetLab = () => {
  useDocumentClass("classic-hud");
  const [store] = useState(installFixtureGame);
  const [mode, setMode] = useState<HudMode>("blitz");
  const [device, setDevice] = useState<Device>("desktop");
  const sheetRef = useRef<HTMLDivElement>(null);
  return (
    <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: PLAYER } as never}>
      <div
        ref={sheetRef}
        data-hud-mode={mode}
        data-hud-device={device === "phone" ? "phone" : undefined}
        className="ui min-h-screen bg-[#0b1418] p-6"
      >
        <header data-lab-chrome className="mb-6 flex flex-wrap items-center gap-4 text-sm text-white/80">
          <h1 className="text-xl font-bold text-white">Style sheet</h1>
          <span>The HUD scope of src/tokens.ts on the left; the type scale, then each element in every state.</span>
          <label className="flex items-center gap-2">
            Mode
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as HudMode)}
              className="rounded bg-black/60 px-2 py-1"
            >
              {(Object.keys(HUD_MODES) as HudMode[]).map((key) => (
                <option key={key} value={key}>
                  {key[0].toUpperCase() + key.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Device
            <select
              value={device}
              onChange={(event) => setDevice(event.target.value as Device)}
              className="rounded bg-black/60 px-2 py-1"
            >
              <option value="desktop">Desktop</option>
              <option value="phone">Phone (390 wide, touch)</option>
            </select>
          </label>
          <nav className="ml-auto flex gap-3 underline">
            <Link to="/lab/kit/shell">Shell kit</Link>
            <Link to="/lab/kit/tokens">Tokens</Link>
            <Link to="/lab/kit/panels">HUD panels</Link>
            <Link to="/lab/kit/guidance">Guidance</Link>
            <Link to="/lab/kit/icons">Icons</Link>
          </nav>
        </header>
        <div className="flex items-start gap-6">
          <TokenEditor key={mode} target={sheetRef} mode={mode} />
          <DeviceContext.Provider value={device}>
            <main
              className={
                device === "phone"
                  ? "flex w-[390px] flex-none flex-col gap-4 rounded-[28px] border border-white/20 p-3"
                  : "flex min-w-0 flex-1 flex-col gap-6"
              }
            >
              <TypeSection />
              <ButtonsSection />
              <AmountSection />
              <TooltipSection />
              <PanelSection />
              <TabsSection />
              <ChipsSection />
              <RingSection />
              <RowsSection />
              <EventsSection store={store} />
              <WindowSection />
              <PlatesSection />
              <MinimapSection />
            </main>
          </DeviceContext.Provider>
        </div>
        <Tooltip />
      </div>
    </GameProvider>
  );
};

/** One element: what it is for, the sheet's version in its states, and what the game draws today. */
const Element = ({ name, rule, sheet, today }: { name: string; rule: string; sheet: ReactNode; today: ReactNode }) => {
  const phone = useContext(DeviceContext) === "phone";
  return (
    <section data-sheet-element={name} className="rounded-lg border border-white/10 bg-black/20 p-4">
      <header data-lab-chrome className="mb-3 flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-bold text-white">{name}</h2>
        <p className="text-sm text-white/60">{rule}</p>
      </header>
      {phone ? (
        <div className="overflow-x-auto">{sheet}</div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-6">
          <div>
            <p data-lab-chrome className="mb-2 text-xs uppercase tracking-wide text-emerald-300/80">
              Sheet
            </p>
            {sheet}
          </div>
          <div className="border-l border-white/10 pl-6">
            <p data-lab-chrome className="mb-2 text-xs uppercase tracking-wide text-red-300/80">
              Today in the game
            </p>
            <div className="flex flex-wrap items-start gap-3">{today}</div>
          </div>
        </div>
      )}
    </section>
  );
};

/** A row of one element drawn in each state the lab can force. */
const StateRow = ({ label, render }: { label: string; render: (state: State) => ReactNode }) => (
  <div className="mb-3 grid grid-cols-[6rem_repeat(5,minmax(0,1fr))] items-center gap-3">
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
  <div data-lab-chrome className="mb-2 grid grid-cols-[6rem_repeat(5,minmax(0,1fr))] gap-3 text-xs text-white/50">
    <span />
    {STATES.map((state) => (
      <span key={state}>{state}</span>
    ))}
  </div>
);

/** Today's HUD text sizes (Tailwind classes and stylesheets across the HUD's code), smallest first. */
const TODAY_SIZES = [8, 9, 10, 11, 12, 13, 13.2, 14, 15, 15.6, 16, 17, 18, 20, 22, 24, 34] as const;
/** Each role's class, written out so Tailwind generates it. */
const ROLE_CLASS: Record<keyof typeof HUD_TYPE, string> = {
  display: "text-hud-display",
  title: "text-hud-title",
  body: "text-hud-body",
  strong: "text-hud-strong",
  label: "text-hud-label",
  badge: "text-hud-badge",
};
const ROLE_SAMPLES: Record<keyof typeof HUD_TYPE, string> = {
  display: "Military",
  title: "Structure Tile · Guards",
  body: "Sacred Hyperstructure of Destiny, held by The Vanguard",
  strong: "1,576 · Deploy",
  label: "points/s · 3/4 · 13m · 0·103",
  badge: "1.2K",
};

const TypeSection = () => (
  <Element
    name="Type scale"
    rule="A handful of sizes and weights, each named by its role; a HUD text takes a role, never a size."
    sheet={
      <div className="flex flex-col gap-3">
        {(Object.keys(HUD_TYPE) as (keyof typeof HUD_TYPE)[]).map((role) => (
          <div key={role} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3">
            <span data-lab-chrome className="font-mono text-xs text-white/60">
              {role} {HUD_TYPE[role].size}/{HUD_TYPE[role].weight}
            </span>
            <span className={ROLE_CLASS[role]} style={{ color: "rgb(var(--hud-ink))" }}>
              {ROLE_SAMPLES[role]}
            </span>
          </div>
        ))}
      </div>
    }
    today={
      <div className="flex flex-col gap-1">
        <span data-lab-chrome className="text-xs text-white/50">
          {TODAY_SIZES.length} sizes and 5 weights in the HUD's code today (text-xs is 15.6px there, text-sm 14px):
        </span>
        {TODAY_SIZES.map((size) => (
          <span key={size} style={{ fontSize: `${size}px` }} className="font-ui leading-tight text-gold">
            {size}px · Guards 1,576
          </span>
        ))}
      </div>
    }
  />
);

const forced = (state: State) => (state === "rest" || state === "disabled" ? undefined : state);

const ButtonsSection = () => (
  <Element
    name="Button"
    rule="Primary is a screen's one verb, secondary sits beside it, quiet is a way out; an icon button is a square secondary."
    sheet={
      <>
        <StateHeads />
        {(["primary", "secondary", "quiet"] as const).map((kind) => (
          <StateRow
            key={kind}
            label={kind}
            render={(state) => (
              <HudButton kind={kind} data-state={forced(state)} disabled={state === "disabled"}>
                {kind === "primary" ? "Deploy" : kind === "secondary" ? "Transfer" : "Cancel"}
              </HudButton>
            )}
          />
        ))}
        <StateRow
          label="with icon"
          render={(state) => (
            <HudButton kind="primary" icon="military" data-state={forced(state)} disabled={state === "disabled"}>
              Deploy
            </HudButton>
          )}
        />
        <StateRow
          label="icon"
          render={(state) => (
            <HudIconButton
              icon="transfer"
              label="Transfer"
              data-state={forced(state)}
              disabled={state === "disabled"}
            />
          )}
        />
        <StateRow
          label="small"
          render={(state) => (
            <HudButton kind="secondary" size="sm" data-state={forced(state)} disabled={state === "disabled"}>
              Max
            </HudButton>
          )}
        />
      </>
    }
    today={
      <>
        <KitButton role="primary" word="Deploy" />
        <KitButton role="secondary" word="Transfer" />
        <KitButton role="outline" word="Cancel" />
        {(["default", "primary", "gold", "outline", "secondary", "success", "red", "danger", "opaque"] as const).map(
          (variant) => (
            <AtomButton key={variant} variant={variant}>
              {variant}
            </AtomButton>
          ),
        )}
        <AtomButton variant="outline" size="xs">
          outline xs
        </AtomButton>
        <AtomButton variant="gold" disabled>
          gold disabled
        </AtomButton>
        <button type="button" className={HUD_PILL_BUTTON}>
          HUD pill
        </button>
        <CircleButton size="md" image="transfer" label="Transfer" onClick={() => undefined} variant="hud" />
      </>
    }
  />
);

const AmountSection = () => {
  const [value, setValue] = useState(200);
  const [today, setToday] = useState(200);
  return (
    <Element
      name="Amount field"
      rule="How many: the field, 'of N', and its quick buttons at one height; full, the quick buttons rest disabled."
      sheet={
        <div className="flex flex-col gap-3">
          <HudAmountField value={value} of={500} step={500} onChange={setValue} />
          <HudAmountField value={500} of={500} step={500} onChange={() => undefined} />
          <HudAmountField value={200} of={500} step={500} onChange={() => undefined} state="focus" />
          <HudAmountField value={0} of={0} step={500} onChange={() => undefined} disabled />
        </div>
      }
      today={
        <div className="flex w-full flex-col gap-3">
          <TroopAmount troopCount={today} maxAffordable={500} held={500} onChange={setToday} disabled={false} />
          <TroopAmount troopCount={500} maxAffordable={500} held={500} onChange={() => undefined} disabled={false} />
          <NumberInput value={today} onChange={setToday} max={500} className="w-40" />
        </div>
      }
    />
  );
};

/** An element that shows today's tooltip on hover the way the game does: through the app's one tooltip store. */
const TodayTipAnchor = ({ label, content }: { label: string; content: ReactNode }) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={ref}
      className="cursor-help rounded border border-white/20 px-2 py-1 text-xs text-white/80"
      onMouseEnter={() => setTooltip({ content, anchorElement: ref.current ?? undefined, position: "top" })}
      onMouseLeave={() => setTooltip(null)}
    >
      {label}
    </span>
  );
};

const TooltipSection = () => (
  <Element
    name="Tooltip and the map's order line"
    rule="One tooltip; its words are its own. A line, why not (and when), and how, as a cue."
    sheet={
      <div className="flex flex-wrap items-start gap-4">
        <HudTip line="Wheat, 1,200 held" />
        <HudTip line="Deploy an army here" how="Right-click" />
        <HudTip line="Explore" why="Needs 30 stamina, ready in under a minute" />
        <HudTip line="Move here · 2 wheat" how="Right-click to move, Shift to queue" />
      </div>
    }
    today={
      <>
        <span data-lab-chrome className="w-full text-xs text-white/50">
          Hover each: the game's tooltip, filled as its callers fill it.
        </span>
        <TodayTipAnchor
          label="named tip (TipLine)"
          content={<TipLine line="Needs 30 stamina, ready in under a minute" />}
        />
        <TodayTipAnchor label="plain string" content="Deploy an army here. Right-click." />
        <TodayTipAnchor label="caller's gold div" content={<div className="text-gold">Invite to tribe</div>} />
        <TodayTipAnchor
          label="order tip"
          content={
            <>
              <TipLine line="Move here · 2 wheat" />
              <span className="block text-center font-sans text-[11px] leading-snug text-kit-muted">Right-click</span>
            </>
          }
        />
        <span className="rounded border border-white/20 px-2 py-1 text-xs text-white/80" title="Native title tooltip">
          native title
        </span>
      </>
    }
  />
);

const PanelSection = () => (
  <Element
    name="Panel"
    rule="The HUD's one panel: a header band naming it over a divider, a cue at its end, then its body."
    sheet={
      <div className="flex gap-4">
        <div className="w-80">
          <HudPanel title="Structure Tile · (-4, -3)" cue="1/1">
            <HudRow title="djizus" detail="Egonal" />
          </HudPanel>
        </div>
        <div className="w-80">
          <HudPanel>
            <p className="ui-row__detail">A panel with no header (the minimap's).</p>
          </HudPanel>
        </div>
      </div>
    }
    today={
      <>
        <div className="w-72">
          <InfoBubble title="Structure Tile · (-4, -3)" cue="1/1">
            <p className="text-sm text-gold">djizus · Egonal</p>
          </InfoBubble>
        </div>
        <div className={cn(OVERLAY_SURFACE_BASE, "w-72 rounded-lg p-3 text-sm text-gold")}>A local overlay surface</div>
      </>
    }
  />
);

const TabsSection = () => {
  const [tab, setTab] = useState<"realms" | "camps" | "rifts">("realms");
  const [hud, setHud] = useState<"structure" | "biome">("structure");
  const [view, setView] = useState<"realm" | "world">("world");
  return (
    <Element
      name="Tabs"
      rule="A strip of choices; the chosen one in gold over a gold rule, a count as a chip."
      sheet={
        <div className="flex flex-col gap-4">
          <HudTabs
            tabs={[
              { key: "realms", label: "Realms", count: 3 },
              { key: "camps", label: "Camps", count: 1 },
              { key: "rifts", label: "Rifts", count: 0, disabled: true },
            ]}
            value={tab}
            onChange={setTab}
          />
          <HudTabs
            tabs={[
              { key: "realms", label: "rest" },
              { key: "camps", label: "hover" },
              { key: "rifts", label: "focus" },
            ]}
            value="realms"
            onChange={() => undefined}
            states={{ camps: "hover", rifts: "focus" }}
          />
        </div>
      }
      today={
        <div className="flex w-full flex-col gap-4">
          <HudTabStrip
            tabs={[
              { key: "structure", label: "Structure" },
              { key: "biome", label: "Biome" },
            ]}
            selected={hud}
            onSelect={setHud}
          />
          <AtomTabs>
            <AtomTabs.List>
              <AtomTabs.Tab>Transfer</AtomTabs.Tab>
              <AtomTabs.Tab>History</AtomTabs.Tab>
            </AtomTabs.List>
          </AtomTabs>
          <ViewSwitch
            label="View"
            views={[
              { id: "realm", word: "Realm" },
              { id: "world", word: "World" },
            ]}
            lit={view}
            onChange={setView}
          />
        </div>
      }
    />
  );
};

const ChipsSection = () => (
  <Element
    name="Chip"
    rule="A small tag: a count in gold, a state in its tone, a troop tier in its colour."
    sheet={
      <div className="flex flex-wrap items-center gap-3">
        <HudChip>3</HudChip>
        <HudChip>1,455</HudChip>
        <HudChip tone="good">Ready</HudChip>
        <HudChip tone="warn">2m left</HudChip>
        <HudChip tone="bad">Under attack</HudChip>
        <HudTierChip tier={1} />
        <HudTierChip tier={2} />
        <HudTierChip tier={3} />
      </div>
    }
    today={
      <>
        <KitChip icons={["wheat"]} value="1,200" label="Wheat" />
        <KitTierChip tier={1} showWord />
        <KitTierChip tier={3} showWord={false} />
        <TroopTierChip tier="T1" />
        <TroopTierChip tier="T2" size="md" />
        <TroopTierChip tier="T3" size="label" />
        <PriceChip of="essence" amount={300} />
      </>
    }
  />
);

const RingSection = () => (
  <Element
    name="Ring badge"
    rule="A painting in a round well; buildings top left, the amount on the foot, the time left on the right; an arc for production."
    sheet={
      <div className="flex items-center gap-6 pb-2">
        <HudRing icon="wheat" label="Wheat" corner={3} foot="1.2K" side="17m" progress={0.6} />
        <HudRing icon="essence" label="Essence" foot="6.4K" />
        <HudRing icon="labor" label="Labor" corner={1} foot="240" progress={0.2} side="3m" />
      </div>
    }
    today={
      <>
        <ProductionStatusBadge
          resource={ResourcesIds.Wheat}
          isProducing
          timeRemainingSeconds={1020}
          buildings={3}
          amount="1.2K"
          size="md"
        />
        <ProductionStatusBadge
          resource={ResourcesIds.Essence}
          isProducing={false}
          timeRemainingSeconds={null}
          amount="6.4K"
          size="md"
        />
        <Medallion icon="realm" size="lg" corner={2} foot="Lv 2" />
      </>
    }
  />
);

const LabHoldings = () => <HoldingsList holdings={useHoldings()} />;

const RowsSection = () => (
  <Element
    name="List row"
    rule="One thing of a list: what it is, what it says, its value; hover lights it, the chosen one carries a gold bar."
    sheet={
      <div className="flex w-80 flex-col gap-1">
        <HudRow title="Egonal" detail="Settlement · 1,000 guarding" trail="2" selected />
        <HudRow title="Noykkuynoyk" detail="City · Undefended" trail="1" state="hover" />
        <HudRow title="'oak Leukue" detail="Kingdom · 1,455 guarding" trail="3" />
      </div>
    }
    today={
      <div className="w-80">
        <LabHoldings />
      </div>
    }
  />
);

const EventsSection = ({ store }: { store: NativeFactStore }) => (
  <Element
    name="Event row"
    rule="What happened, said once: its time, a mark in its tone, the words; a notice is one too (no separate toast)."
    sheet={
      <div className="flex w-96 flex-col">
        <HudEventRow time="12:04">
          Explored · <strong>+5 points</strong>
        </HudEventRow>
        <HudEventRow time="12:05" tone="good">
          Found <strong>+200 Essence</strong>
        </HudEventRow>
        <HudEventRow time="12:07" tone="bad">
          Army lost: <strong>1,000 Knights</strong> to The Vanguard
        </HudEventRow>
        <HudEventRow time="12:08" tone="warn">
          Not sent: the army needs 30 stamina
        </HudEventRow>
      </div>
    }
    today={
      <div className="flex w-80 flex-col gap-1">
        {eventsRows(store).map((row) => (
          <FeedRowLine key={row.id} row={row} />
        ))}
      </div>
    }
  />
);

const WindowSection = () => (
  <Element
    name="Window"
    rule="A panel the size of a task (Military, Transfer): its title bar with a way out, then its body."
    sheet={
      <div className="w-[34rem]">
        <HudWindow title="Military" icon="military" onClose={() => undefined}>
          <HudAmountField value={200} of={500} step={500} onChange={() => undefined} />
          <div className="mt-4 flex justify-end gap-2">
            <HudButton kind="quiet">Cancel</HudButton>
            <HudButton kind="primary" icon="military">
              Deploy
            </HudButton>
          </div>
        </HudWindow>
      </div>
    }
    today={
      <div className={cn(OVERLAY_SURFACE_BASE, "w-[30rem] rounded-xl")}>
        <SurfaceFrame title="Military" icon="military" onClose={() => undefined} bodyClassName="p-4">
          <TroopAmount troopCount={200} maxAffordable={500} held={500} onChange={() => undefined} disabled={false} />
        </SurfaceFrame>
      </div>
    }
  />
);

const ARMY: ArmyPlate = {
  kind: "army",
  relation: "enemy",
  owner: "Moonhand",
  homeName: "Xeswet",
  code: "7·12",
  troops: { type: "paladin", tier: 3, count: 300 },
  stamina: 0.6,
};
const REALM: StructurePlate = {
  kind: "structure",
  relation: "own",
  owner: "djizus",
  rank: "Kingdom",
  name: "Sangsang",
  named: true,
  code: "19·1",
  guards: [
    { type: "crossbowman", tier: 1, count: 516 },
    { type: "knight", tier: 2, count: 577 },
    { type: "paladin", tier: 3, count: 638 },
  ],
  arrivals: [{ troops: { type: "paladin", tier: 2, count: 300 }, secondsLeft: 780 }],
  icon: "realm",
};
const RIFT: StructurePlate = {
  kind: "structure",
  relation: "neutral",
  owner: "The Vanguard",
  name: "Essence Rift",
  named: false,
  reward: "1,200 Essence",
  code: "0·103",
  guards: [{ type: "knight", tier: 2, count: 300 }],
  arrivals: [],
  icon: "rift",
};

/** A plate as the layer places it, standing in the page instead of over the map. */
const PlateAt = ({
  plate,
  open = false,
  selected = false,
}: {
  plate: ArmyPlate | StructurePlate;
  open?: boolean;
  selected?: boolean;
}) => (
  <div className="mp !static !overflow-visible">
    <div className="mp-at !static" data-relation={plate.relation} data-selected={selected}>
      <Plate plate={plate} open={open} />
    </div>
  </div>
);

const PlatesSection = () => (
  <Element
    name="Map plate"
    rule="Two short rows at rest, three opened, on the panel's surface; the side's colour on its bar and its player."
    sheet={
      <div className="flex flex-wrap items-end gap-4">
        <PlateAt plate={ARMY} />
        <PlateAt plate={ARMY} open />
        <PlateAt plate={REALM} />
        <PlateAt plate={REALM} open selected />
        <PlateAt plate={RIFT} />
        <PlateAt plate={RIFT} open />
        <PlateAt plate={{ ...REALM, relation: "ally", owner: "Kestrel", rank: "City", name: "Šommun", guards: [] }} />
        <div className="mp !static">
          <div className="mp-at !static" data-relation="enemy">
            <Pin plate={ARMY} />
          </div>
        </div>
      </div>
    }
    today={
      <span className="text-sm text-white/70">
        The plates already draw on the panel's surface (map-labels round 5); the sheet gives their colours and surface
        from its tokens instead of the plates' own variables, so they follow the sheet.
      </span>
    }
  />
);

const MINIMAP_HEXES = Array.from({ length: 42 }, (_, index) => index);

const MinimapSection = () => (
  <Element
    name="Minimap frame"
    rule="A panel with no header, its map in a well."
    sheet={
      <div className="w-80">
        <HudMinimapFrame>
          <svg viewBox="0 0 280 180" className="block h-44 w-full">
            {MINIMAP_HEXES.map((index) => (
              <circle
                key={index}
                cx={20 + (index % 7) * 40 + (Math.floor(index / 7) % 2) * 20}
                cy={20 + Math.floor(index / 7) * 28}
                r={12}
                fill={index % 5 === 0 ? "rgb(223 170 84 / 0.6)" : "rgb(255 255 255 / 0.08)"}
              />
            ))}
          </svg>
        </HudMinimapFrame>
      </div>
    }
    today={
      <div className="w-72">
        <InfoBubble>
          <div className="h-40 rounded bg-black/40" />
        </InfoBubble>
      </div>
    }
  />
);

/** The HUD scope's tokens, read from src/tokens.ts and editable: a change applies at once to the sheet's elements here; Copy gives the changed values. */
const tokenGroups = (mode: HudMode): readonly { group: string; names: readonly string[] }[] => [
  {
    group: "Type (HUD_TYPE)",
    names: Object.keys(HUD_TYPE).flatMap((role) => [`--hud-text-${role}`, `--hud-weight-${role}`]),
  },
  { group: `Surface (HUD_MODES.${mode})`, names: Object.keys(HUD_MODES[mode]).map((name) => `--hud-${name}`) },
  { group: "Sheet (HUD_SHEET)", names: Object.keys(HUD_SHEET).map((name) => `--hud-${name}`) },
  { group: "Built from gold (HUD_DERIVED)", names: Object.keys(HUD_DERIVED).map((name) => `--hud-${name}`) },
];

const TokenEditor = ({ target, mode }: { target: React.RefObject<HTMLDivElement | null>; mode: HudMode }) => {
  const groups = tokenGroups(mode);
  // The tokens as this mode sets them, read where the mode applies (the editor mounts again with each mode).
  const [values, setValues] = useState<Record<string, string>>(() => {
    const probe = document.createElement("div");
    probe.dataset.hudMode = mode;
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const read = Object.fromEntries(
      tokenGroups(mode)
        .flatMap(({ names }) => names)
        .map((name) => [name, style.getPropertyValue(name).trim()]),
    );
    probe.remove();
    return read;
  });
  const [changed, setChanged] = useState<Record<string, string>>({});
  const set = (name: string, value: string) => {
    target.current?.style.setProperty(name, value);
    setValues((current) => ({ ...current, [name]: value }));
    setChanged((current) => ({ ...current, [name]: value }));
  };
  const copy = () =>
    void navigator.clipboard?.writeText(
      `:root {\n${Object.entries(changed)
        .map(([name, value]) => `  ${name}: ${value};`)
        .join("\n")}\n}`,
    );
  return (
    <aside
      data-lab-chrome
      className="sticky top-4 flex w-80 flex-none flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-white/80"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Tokens</h2>
        <button type="button" onClick={copy} className="rounded border border-white/30 px-2 py-0.5">
          Copy {Object.keys(changed).length} changed
        </button>
      </div>
      {groups.map(({ group, names }) => (
        <div key={group} className="flex flex-col gap-1">
          <h3 className="font-sans text-xs font-semibold text-white/60">{group}</h3>
          {names.map((name) => (
            <label key={name} className="flex items-center gap-2">
              <span
                className="size-4 flex-none rounded border border-white/20"
                style={{ background: /^\d+ \d+ \d+$/.test(values[name] ?? "") ? `rgb(${values[name]})` : values[name] }}
              />
              <span className="w-32 flex-none truncate font-mono">{name.replace("--hud-", "")}</span>
              <input
                value={values[name] ?? ""}
                onChange={(event) => set(name, event.target.value)}
                className="min-w-0 flex-1 rounded bg-black/60 px-1 py-0.5 font-mono"
              />
            </label>
          ))}
        </div>
      ))}
    </aside>
  );
};
