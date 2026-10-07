import { Notice } from "@/ui/design-system/kit/notice";
import { OFFLINE, TRY_AGAIN } from "@/ui/design-system/kit/words";
import { ArmyStatusBar } from "@/ui/features/frontier/hud/action-bar";
import { ArmyToken, OpenSlot } from "@/ui/features/frontier/hud/army-token";
import type { DayClock } from "@/ui/features/frontier/hud/day-clock";
import { HudBands } from "@/ui/features/frontier/hud/hud-bands";
import { MenuSheet } from "@/ui/features/frontier/hud/menu-sheet";
import { PlaceNav } from "@/ui/features/frontier/hud/place-nav";
import { StatusStrip, type StoreReading } from "@/ui/features/frontier/hud/status-strip";
import { useParams } from "react-router-dom";

const HOUR = 3_600;
const NOW = new Date(2026, 9, 7, 14, 26).getTime() / 1000;

/** The handoff's fiction: Day 12 at 14:26, today ends at 21:40 (7h 14m left), tomorrow lasts 12h. */
const CLOCK: DayClock = {
  day: 12,
  endsAt: NOW + 7 * HOUR + 14 * 60,
  secondsLeft: 7 * HOUR + 14 * 60,
  tomorrowSeconds: 12 * HOUR,
  shareLeft: (7 * HOUR + 14 * 60) / (16 * HOUR),
  tone: "calm",
};

const UNKNOWN_CLOCK: DayClock = {
  day: undefined,
  endsAt: undefined,
  secondsLeft: undefined,
  tomorrowSeconds: undefined,
  shareLeft: undefined,
  tone: "calm",
};

const store = (
  kind: StoreReading["kind"],
  amount: number | undefined,
  limit?: number,
  tone: StoreReading["tone"] = "calm",
) => ({
  kind,
  amount,
  limit,
  tone,
  flyTarget: `lab-${kind}`,
});

/** A city: 18,000 a store; Essence has no limit. */
const STORES = [
  store("essence", 18_250),
  store("labor", 9_640, 18_000),
  store("wheat", 4_410, 18_000),
  store("troops", 1_200, 18_000),
];
const FULL_STORES = [
  store("essence", 18_250),
  store("labor", 18_000, 18_000, "ember"),
  store("wheat", 17_580, 18_000, "amber"),
  store("troops", 1_200, 18_000),
];
const UNKNOWN_STORES = [
  store("essence", undefined),
  store("labor", undefined, 0),
  store("wheat", undefined, 0),
  store("troops", undefined, 0),
];

type LabArmy = { troops?: number; xp?: number; stamina?: number; tier?: boolean };
const ARMIES: LabArmy[] = [
  { troops: 5_000, xp: 260, stamina: 90, tier: true },
  { troops: 1, xp: 40, stamina: 150 },
  { troops: 1_200, xp: 120, stamina: 21, tier: true },
];
const UNKNOWN_ARMIES: LabArmy[] = [{}, {}, {}];

const STATES = {
  idle: { clock: CLOCK, stores: STORES, armies: ARMIES },
  selected: { clock: CLOCK, stores: STORES, armies: ARMIES, selected: 0 },
  full: { clock: CLOCK, stores: FULL_STORES, armies: ARMIES, realmDot: "ember" as const },
  offline: { clock: UNKNOWN_CLOCK, stores: UNKNOWN_STORES, armies: UNKNOWN_ARMIES, offline: true },
  menu: { clock: CLOCK, stores: STORES, armies: ARMIES, menu: true },
  empty: { clock: CLOCK, stores: STORES, armies: [] },
} as const;

type LabState = {
  clock: DayClock;
  stores: readonly StoreReading[];
  armies: readonly LabArmy[];
  selected?: number;
  realmDot?: "ember";
  offline?: boolean;
  menu?: boolean;
};

const SLOTS = 4;
const noop = () => undefined;

/**
 * Dev only: the Map HUD's states on the lab fixtures, at /lab/kit/hud/<state> (idle, selected, full, offline, menu,
 * empty). The same components the live HUD draws, fed the handoff's fiction instead of the game's facts.
 */
export const HudLab = () => {
  const { state = "idle" } = useParams();
  const lab: LabState = STATES[state as keyof typeof STATES] ?? STATES.idle;
  const selected = lab.selected === undefined ? undefined : lab.armies[lab.selected];
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,var(--frontier-line),var(--frontier-void))]"
      />
      <HudBands
        top={<StatusStrip clock={lab.clock} stores={[...lab.stores]} />}
        foot={
          <>
            {lab.offline && <Notice icon="Of" line={OFFLINE} verb={TRY_AGAIN} onVerb={noop} ember />}
            {selected && <ArmyStatusBar stamina={selected.stamina} secondsToFull={2 * HOUR} revealYield={500} />}
            <nav aria-label="Armies" className="pointer-events-auto flex gap-1.5">
              {lab.armies.map((army, index) => (
                <ArmyToken
                  key={index}
                  label={`Army ${index + 1}`}
                  art={army.troops === undefined ? undefined : "/images/armies/knightT1.png"}
                  xp={army.xp}
                  stamina={army.stamina === undefined ? undefined : { current: army.stamina, max: 150 }}
                  troops={army.troops}
                  canBuyTier={army.tier === true}
                  selected={lab.selected === index}
                  onPick={noop}
                />
              ))}
              {Array.from({ length: SLOTS - lab.armies.length }, (_, index) => (
                <OpenSlot key={index} label="Deploy" pulse={index === 0 && lab.armies.length === 0} onDeploy={noop} />
              ))}
            </nav>
            <PlaceNav
              place={lab.menu ? "menu" : "map"}
              onGo={noop}
              realmDot={lab.realmDot}
              researchDot={!lab.offline}
              unread={lab.offline ? 0 : 3}
            />
          </>
        }
      >
        {lab.menu && (
          <MenuSheet
            rank="#12"
            onToday={noop}
            onSeason={noop}
            onGuide={noop}
            onSettings={noop}
            onExit={noop}
            onClose={noop}
          />
        )}
      </HudBands>
    </>
  );
};
