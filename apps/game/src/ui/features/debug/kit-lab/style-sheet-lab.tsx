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
  HudAmountSlider,
  HudBubble,
  HudButton,
  HudCheck,
  HudChip,
  HudConfirm,
  HudEmpty,
  HudEventRow,
  HudField,
  HudIconButton,
  HudLoading,
  HudMenu,
  HudMeter,
  HudMinimapFrame,
  HudNotice,
  HudPanel,
  HudPill,
  HudPortrait,
  HudRing,
  HudRow,
  HudSelect,
  HudSetting,
  HudSkeleton,
  HudSwitch,
  HudTabs,
  HudTierChip,
  HudTip,
  HudTransfer,
  HudWindow,
} from "@/ui/design-system/kit/hud-elements";
import { Checkbox } from "@/ui/design-system/atoms/checkbox";
import { Confirm } from "@/ui/design-system/kit/confirm";
import { Notice } from "@/ui/design-system/kit/notice";
import { Switch } from "@/ui/design-system/kit/switch";
import { AmountSlider } from "@/ui/design-system/kit/amount-slider";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { TOP_PILL } from "@/ui/features/world/containers/top-header/top-pill";
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

import { eventStories, installFixtureGame, PLAYER } from "./fixture-game";

const STATES = ["rest", "hover", "pressed", "focus", "disabled"] as const;

/** Each game as its age of the lore, and the age's painting its colours come from (public/images/landscapes). */
const AGE_NAMES: Record<HudMode, string> = {
  blitz: "Blitz · Age I",
  frontier: "Frontier · Age II",
  eternum: "Eternum · Age III",
};
const AGE_PAINTINGS: Record<HudMode, string> = {
  blitz: "/images/landscapes/blitz-spires-800.webp",
  frontier: "/images/landscapes/frontier-mist-800.webp",
  eternum: "/images/landscapes/eternum-restoration-800.webp",
};

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
                  {AGE_NAMES[key]}
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
              <AgesSection />
              <TypeSection />
              <ButtonsSection />
              <BubbleSection />
              <AmountSection />
              <TransferSection />
              <FieldSection />
              <MenuSection />
              <SettingsSection />
              <TooltipSection />
              <PanelSection />
              <TabsSection />
              <ChipsSection />
              <RingSection />
              <MeterSection />
              <RowsSection />
              <EventsSection store={store} />
              <WindowSection />
              <ConfirmSection />
              <LoadingSection />
              <TopBarSection />
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
  const [value, setValue] = useState(1_200);
  const [today, setToday] = useState(200);
  return (
    <Element
      name="Troop amount"
      rule="How many troops: the amount typed beside its name, a slider between its ends, a stop where the army's room runs out, quick steps for a share."
      sheet={
        <div className="flex max-w-xl flex-col gap-6">
          <HudAmountSlider
            name="Paladins"
            value={value}
            max={2_000}
            stop={1_800}
            note="1,800 fit in the army"
            onChange={setValue}
          />
          <HudAmountSlider
            name="Knights"
            value={0}
            max={0}
            disabled
            onChange={() => undefined}
            note="No knights on hand"
          />
        </div>
      }
      today={
        <div className="flex w-full flex-col gap-3">
          <TroopAmount troopCount={today} maxAffordable={500} held={500} onChange={setToday} disabled={false} />
          <TroopAmount troopCount={500} maxAffordable={500} held={500} onChange={() => undefined} disabled={false} />
          <span data-lab-chrome className="text-xs text-white/50">
            The kit's slider (shell, Frontier):
          </span>
          <AmountSlider label="Troops" icon="troops" value={today} max={500} stop={450} onChange={setToday} />
        </div>
      }
    />
  );
};

const TransferSection = () => {
  const [rows, setRows] = useState([
    { icon: "wheat" as const, name: "Wheat", held: 6_400, value: 1_200 },
    { icon: "wood" as const, name: "Wood", held: 2_100, value: 0 },
    { icon: "essence" as const, name: "Essence", held: 380, value: 380 },
  ]);
  return (
    <Element
      name="Transfer sliders"
      rule="What a transfer moves: one row per resource, its painting, name and what is held, a slider and the amount typed (sliders, as the transfer had them)."
      sheet={
        <div className="max-w-2xl">
          <HudTransfer
            rows={rows.map((row, index) => (index === 1 ? { ...row, state: "hover" } : row))}
            onChange={(index, amount) =>
              setRows((current) => current.map((row, at) => (at === index ? { ...row, value: amount } : row)))
            }
          />
        </div>
      }
      today={
        <span className="text-sm text-white/70">
          Today the Transfer window types each amount in a field (economy/transfers/transfer-window.tsx); the owner
          found the sliders it had before worked better.
        </span>
      }
    />
  );
};

const BubbleSection = () => (
  <Element
    name="Action bubble and badge"
    rule="The HUD's round actions: a painting in a disc, its word under it, a count to act on as a badge on the rim."
    sheet={
      <>
        <StateHeads />
        <StateRow
          label="bubble"
          render={(state) => (
            <HudBubble
              icon="military"
              word="Military"
              count={state === "rest" ? 2 : undefined}
              state={forced(state)}
              disabled={state === "disabled"}
            />
          )}
        />
        <StateRow label="open" render={() => <HudBubble icon="transfer" word="Transfer" pressed />} />
      </>
    }
    today={<CircleButton size="lg" image="military" label="Military" onClick={() => undefined} variant="hud" />}
  />
);

const FieldSection = () => {
  const [name, setName] = useState("Egonal");
  return (
    <Element
      name="Field"
      rule="What is typed (a name, a search), in a well; focus rings it in the accent."
      sheet={
        <div className="flex flex-wrap gap-4">
          <HudField value={name} onChange={setName} />
          <HudField value="" placeholder="Search a realm" icon="search" onChange={() => undefined} />
          <HudField value="Egonal" state="focus" onChange={() => undefined} />
          <HudField value="Egonal" disabled onChange={() => undefined} />
        </div>
      }
      today={<NumberInput value={200} onChange={() => undefined} className="w-40" />}
    />
  );
};

const MenuSection = () => (
  <Element
    name="Select and menu"
    rule="A choice opened from its trigger, or a right-click on the map: the items, the chosen one checked, a rule between groups."
    sheet={
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-col gap-3">
          <HudSelect value="Smart" />
          <HudSelect value="Smart" state="hover" />
          <HudSelect value="Smart" state="focus" />
        </div>
        <HudMenu
          items={[
            { label: "Smart", checked: true },
            { label: "Custom", state: "hover" },
            { label: "Off" },
            { kind: "rule" },
            { label: "Idle", disabled: true, hint: "Level 2" },
          ]}
        />
        <HudMenu
          items={[
            { label: "Move here", icon: "map-army", hint: "2 wheat" },
            { label: "Explore", icon: "search", disabled: true, hint: "30 stamina" },
            { kind: "rule" },
            { label: "Attack", icon: "military", tone: "bad" },
          ]}
        />
      </div>
    }
    today={
      <span className="text-sm text-white/70">
        Today: the atoms Select and the dropdown list (design-system/atoms/select, molecules/dropdown-list), the realm
        card's automation select and the map's structure context menu, each styled on its own.
      </span>
    }
  />
);

const SettingsSection = () => {
  const [tips, setTips] = useState(true);
  const [music, setMusic] = useState(false);
  const [checked, setChecked] = useState(true);
  return (
    <Element
      name="Switch, checkbox and settings"
      rule="On or off at once (a switch), one of several chosen together (a checkbox); a setting row names what it sets and what that does."
      sheet={
        <div className="flex max-w-md flex-col">
          <HudSetting name="Next up tips" about="The coach's steps; alerts always show">
            <HudSwitch on={tips} label="Next up tips" onChange={setTips} />
          </HudSetting>
          <HudSetting name="Music">
            <HudSwitch on={music} label="Music" onChange={setMusic} state="focus" />
          </HudSetting>
          <HudSetting name="Show armies" about="On the minimap">
            <HudCheck checked={checked} label="Show armies" onChange={setChecked} />
          </HudSetting>
          <HudSetting name="Sound" about="Unavailable in this browser">
            <HudSwitch on={false} label="Sound" disabled onChange={() => undefined} />
          </HudSetting>
        </div>
      }
      today={
        <div className="flex flex-col gap-3">
          <Switch on={tips} label="Next up tips" onToggle={() => setTips(!tips)} />
          <Checkbox enabled={checked} onClick={() => setChecked(!checked)} text="Show armies" />
        </div>
      }
    />
  );
};

const MeterSection = () => (
  <Element
    name="Meter"
    rule="How full a thing is: stamina, production, a load; the fill in a tone."
    sheet={
      <div className="flex max-w-xs flex-col gap-3">
        <HudMeter share={0.62} tone="good" label="Stamina" />
        <HudMeter share={0.35} label="Production" />
        <HudMeter share={0.9} tone="warn" label="Storage" />
        <HudMeter share={0.1} tone="bad" label="Food" />
      </div>
    }
    today={
      <span className="text-sm text-white/70">
        Today: the stamina bar, the guard slot bars and the store bars, each drawn on its own.
      </span>
    }
  />
);

const ConfirmSection = () => (
  <Element
    name="Confirm"
    rule="A question that stops the task: what it does and costs, the way back, the verb; red when it cannot be undone."
    sheet={
      <div className="flex flex-wrap gap-4">
        <HudConfirm
          question="Level up Egonal to City?"
          verb="Level up"
          onConfirm={() => undefined}
          onBack={() => undefined}
        >
          <span className="ui-row__detail">Costs 1,200 wheat and 600 wood.</span>
        </HudConfirm>
        <HudConfirm
          question="Attack Moonhand's army?"
          verb="Attack"
          tone="bad"
          onConfirm={() => undefined}
          onBack={() => undefined}
        >
          <HudNotice
            tone="bad"
            line="Your army will be lost"
            why="The forecast: 1,000 Paladins against 2,400 Knights."
          />
        </HudConfirm>
      </div>
    }
    today={
      <div className="relative h-96 w-[36rem] overflow-hidden [transform:translateZ(0)]">
        <Confirm
          question="Level up Egonal?"
          cost="1,200 wheat"
          verb="Level up"
          onConfirm={() => undefined}
          onKeep={() => undefined}
        />
      </div>
    }
  />
);

const LoadingSection = () => (
  <Element
    name="Loading and empty"
    rule="An answer on its way (a spinner and what is awaited), rows standing in for a list, and nothing yet said once with what would fill it."
    sheet={
      <div className="flex flex-wrap items-start gap-8">
        <HudLoading line="Loading your realms…" />
        <div className="w-56">
          <HudSkeleton rows={3} />
        </div>
        <div className="w-64">
          <HudPanel title="Events">
            <HudEmpty icon="clock" line="Nothing has happened yet." />
          </HudPanel>
        </div>
        <div className="w-64">
          <HudPanel title="Armies">
            <HudEmpty
              icon="military"
              line="No army in the field."
              action={
                <HudButton kind="secondary" size="sm">
                  Raise an army
                </HudButton>
              }
            />
          </HudPanel>
        </div>
      </div>
    }
    today={
      <div className="flex flex-col gap-3">
        <LoadingAnimation />
        <span className="text-sm text-white/70">
          Empty states today: each panel's own sentence and style ("No resources yet.").
        </span>
      </div>
    }
  />
);

const TopBarSection = () => (
  <Element
    name="Top bar and portrait"
    rule="The HUD's top line in one rounded strip, a rule between its readings; a portrait centred in its disc."
    sheet={
      <div className="flex flex-col items-start gap-4">
        <HudPill>
          {[
            <span key="p" className="flex items-center gap-2">
              <HudPortrait icon="knight-t1" label="clientlane" />
              <span className="font-semibold">clientlane</span>
            </span>,
            <span key="r" className="ui-row__detail">
              #1 · 310 points
            </span>,
            <span key="t" className="flex items-center gap-1">
              <HudChip>42m left</HudChip>
            </span>,
          ]}
        </HudPill>
      </div>
    }
    today={
      <div className={cn(TOP_PILL)}>
        <span className="text-gold">clientlane · #1 · 310 points</span>
      </div>
    }
  />
);

/** The three ages side by side: each its painting, then the same elements in its colours. */
const AgesSection = () => (
  <Element
    name="Ages"
    rule="Each game wears its age of the lore: the accent and surface from its painting; the elements never change, the primary stays gold."
    sheet={
      <div className="grid grid-cols-3 gap-4">
        {(Object.keys(HUD_MODES) as HudMode[]).map((mode) => (
          <div key={mode} data-hud-mode={mode} className="ui flex flex-col gap-3">
            <img src={AGE_PAINTINGS[mode]} alt={AGE_NAMES[mode]} className="h-28 w-full rounded-lg object-cover" />
            <span data-lab-chrome className="text-sm font-bold text-white">
              {AGE_NAMES[mode]}
            </span>
            <HudPanel title="Structure Tile" cue="3/4">
              <HudRow title="Egonal" detail="Kingdom · 1,455 guarding" selected />
            </HudPanel>
            <HudTabs
              tabs={[
                { key: "a", label: "Realms", count: 3 },
                { key: "b", label: "Camps", count: 1 },
              ]}
              value="a"
              onChange={() => undefined}
            />
            <div className="flex gap-2">
              <HudButton kind="secondary">Transfer</HudButton>
              <HudButton kind="primary">Deploy</HudButton>
            </div>
            <HudMeter share={0.6} label="Production" />
          </div>
        ))}
      </div>
    }
    today={
      <span className="text-sm text-white/70">
        Today: Blitz and Eternum share the War room's teal and gold, Frontier the warm ink; no game has its own colour.
      </span>
    }
  />
);

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
    rule="A painting in a round well; buildings top left and the time left top right in one badge, the amount on the foot; an arc for production."
    sheet={
      <div className="flex items-center gap-6 pb-2">
        <HudRing icon="wheat" label="Wheat" corner={3} timer="17m" foot="1.2K" progress={0.6} />
        <HudRing icon="essence" label="Essence" foot="6.4K" />
        <HudRing icon="labor" label="Labor" corner={1} timer="3m" foot="240" progress={0.2} />
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
    rule="One thing of a list: what it is and what it says; hover lights it, the chosen one carries a bar in the age's accent."
    sheet={
      <div className="flex w-80 flex-col gap-1">
        <HudRow title="Egonal" detail="Settlement · 1,000 guarding" selected />
        <HudRow title="Noykkuynoyk" detail="City · Undefended" state="hover" />
        <HudRow title="'oak Leukue" detail="Kingdom · 1,455 guarding" />
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
    name="Event row and notice"
    rule="What happened, said once: its time, a mark in its tone, the words (every toast is a row in Events); a notice says a line about the screen it sits in."
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
        <div className="mt-4 flex flex-col gap-2">
          <HudNotice tone="good" line="Transfer sent" why="Arrives at Egonal in 4m." />
          <HudNotice tone="warn" line="Storage full" why="Wheat stops at 6,000 until some is spent." />
          <HudNotice tone="bad" line="Not sent" why="The army needs 30 stamina; ready in under a minute." />
        </div>
      </div>
    }
    today={
      <div className="flex w-80 flex-col gap-1">
        {eventStories(store).map((event) => (
          <FeedRowLine key={event.id} event={event} />
        ))}
        <Notice icon="wheat" line="Storage full" verb="Spend" onVerb={() => undefined} />
      </div>
    }
  />
);

const WindowSection = () => (
  <Element
    name="Window"
    rule="A panel the size of a task: its title bar with a way out, its body, and a foot with what it costs on the left, the way out and the one verb on the right."
    sheet={
      <div className="w-[34rem]">
        <HudWindow
          title="Military"
          icon="military"
          onClose={() => undefined}
          note="Deploying costs 1,000 wheat"
          actions={
            <>
              <HudButton kind="quiet">Cancel</HudButton>
              <HudButton kind="primary" icon="military">
                Deploy
              </HudButton>
            </>
          }
        >
          <HudAmountSlider name="Paladins" value={1_200} max={2_000} stop={1_800} onChange={() => undefined} />
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
    rule="Two short rows at rest, three opened (map-labels rounds 1 to 5), every row at one size and height; a name told by weight and the accent, a rank, id or time by colour; the side's colour on its bar and its player."
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
                fill={index % 5 === 0 ? "rgb(var(--hud-accent) / 0.6)" : "rgb(255 255 255 / 0.08)"}
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
  { group: "Built from the accent (HUD_DERIVED)", names: Object.keys(HUD_DERIVED).map((name) => `--hud-${name}`) },
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
