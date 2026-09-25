import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { useFrontierType } from "@/ui/features/frontier/use-frontier-type";
import { useBootDocumentState } from "@/ui/modules/boot-loader/boot-loader-state";
import { Hold } from "@/ui/motion/hold";
import { flySprites, MotionLayer } from "@/ui/motion/motion-layer";
import { INTENSITY, INTENSITY_LABEL, type Intensity } from "@/ui/motion/motion-scale";
import { playHaptic } from "@/ui/motion/motion-settings";
import { Pop } from "@/ui/motion/pop";
import { Sweep } from "@/ui/motion/sweep";
import { LandingCounter } from "@/ui/motion/landing-counter";
import { TickNumber } from "@/ui/motion/tick-number";
import { type ReactNode, useRef, useState } from "react";

const LORDS_BY_INTENSITY = [100, 400, 1_500, 6_000] as const;
const COIN_ICON = "/images/resources/37.png";

/** Dev only: each motion primitive at intensity 0–3, at full and repeat speed, and with reduced motion. */
export const MotionLabView = () => {
  useBootDocumentState("app-ready");
  useFrontierType();
  const [intensity, setIntensity] = useState<Intensity>(0);
  const [speed, setSpeed] = useState(1);
  const [run, setRun] = useState(0);
  const reduced = useWorldAppearanceStore((state) => state.reducedMotion);
  const setReduced = useWorldAppearanceStore((state) => state.setReducedMotion);

  return (
    <div className="min-h-dvh bg-[#0c0a08] p-4 font-sans text-gold">
      <MotionLayer />
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-lg font-semibold">Motion primitives</h1>
        {([0, 1, 2, 3] as const).map((level) => (
          <Toggle key={level} active={intensity === level} onClick={() => setIntensity(level)}>
            {level} · {INTENSITY_LABEL[level]}
          </Toggle>
        ))}
        <Toggle active={speed < 1} onClick={() => setSpeed(speed < 1 ? 1 : 0.5)}>
          Repeat speed
        </Toggle>
        <Toggle active={reduced} onClick={() => setReduced(!reduced)}>
          Reduced motion
        </Toggle>
        <button
          type="button"
          onClick={() => {
            setRun((count) => count + 1);
            playHaptic(intensity);
          }}
          className="min-h-11 rounded-lg bg-gold px-4 font-semibold text-dark-brown"
        >
          Play
        </button>
      </header>
      <div key={run} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Panel title="pop">
          <Pop className="rounded-lg border border-gold/40 px-4 py-3">
            +{LORDS_BY_INTENSITY[intensity].toLocaleString()} LORDS
          </Pop>
        </Panel>
        <Panel title={`hold · ${INTENSITY.extraHoldMs[intensity]} ms extra`}>
          <HoldDemo intensity={intensity} speed={speed} />
        </Panel>
        <Panel title="sweep">
          <Sweep play={run} className="rounded-lg border border-gold/40 px-4 py-3">
            Farm II researched
          </Sweep>
        </Panel>
        <Panel title="tick">
          <TickDemo target={LORDS_BY_INTENSITY[intensity]} speed={speed} />
        </Panel>
        <Panel title="fly → tick">
          <FlyDemo intensity={intensity} speed={speed} run={run} />
        </Panel>
        <Panel title={`burst · ${INTENSITY.particles[intensity]} particles`}>
          <p className="text-sm text-gold/70">World particles through the instanced pools: checked on staging.</p>
        </Panel>
      </div>
    </div>
  );
};

const HoldDemo = ({ intensity, speed }: { intensity: Intensity; speed: number }) => {
  const [pending, setPending] = useState(true);
  const [settled, setSettled] = useState(false);
  // A stand-in for Herald's pre-confirmed result arriving 900 ms in.
  useState(() => window.setTimeout(() => setPending(false), 900));
  return (
    <Hold pending={pending} intensity={intensity} minMs={speed < 1 ? 250 : 600} onSettled={() => setSettled(true)}>
      <span className="inline-block rounded-lg border border-gold/40 px-4 py-3">{settled ? "Opened" : "Opening…"}</span>
    </Hold>
  );
};

const TickDemo = ({ target, speed }: { target: number; speed: number }) => {
  const [value, setValue] = useState(0);
  useState(() => window.setTimeout(() => setValue(target), 100));
  return <TickNumber value={value} speed={speed} className="text-3xl font-semibold" />;
};

/** The coins a chest's LORDS send into the counter: at most 24 in flight, by intensity. */
const FLYING_COINS = [8, 16, 24, 24] as const;
/** A balance already held, so the counter rolls up from it, never from zero. */
const PREVIOUS_BALANCE = 1_200;

const FlyDemo = ({ intensity, speed, run }: { intensity: Intensity; speed: number; run: number }) => {
  const source = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLImageElement>(null);
  const [banked, setBanked] = useState(PREVIOUS_BALANCE);
  const [nudge, setNudge] = useState(0);
  // Idle until Play: the counter starts at the previous balance, and only a Play sends the coins.
  useState(() =>
    run === 0
      ? undefined
      : window.setTimeout(() => {
          const box = source.current?.getBoundingClientRect();
          if (!box || !counter.current) return;
          flySprites({
            from: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
            to: counter.current,
            icon: COIN_ICON,
            count: FLYING_COINS[intensity],
            speed,
            onArrive: (index) => {
              if (index === 0) setBanked((total) => total + LORDS_BY_INTENSITY[intensity]);
              setNudge((count) => count + 1);
            },
          });
        }, 100),
  );
  return (
    <div className="flex w-full items-center justify-between">
      <div ref={source} className="rounded-lg border border-gold/40 px-3 py-2">
        Chest
      </div>
      <span className="text-xl font-semibold">
        <LandingCounter ref={counter} icon={COIN_ICON} value={banked} nudge={nudge} speed={speed} /> LORDS
      </span>
    </div>
  );
};

const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={cn(OVERLAY_SURFACE_BASE, "flex min-h-32 flex-col gap-3 rounded-xl p-3")}>
    <h2 className="text-xs font-semibold text-gold/70">{title}</h2>
    <div className="flex flex-1 items-center justify-center">{children}</div>
  </section>
);

const Toggle = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn("min-h-11 rounded-lg border px-3 text-sm", active ? "border-gold bg-gold/20" : "border-gold/30")}
  >
    {children}
  </button>
);
