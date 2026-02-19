import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Gamepad2, Coins, Lock, RefreshCw } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

interface FlywheelMetrics {
  weeklyRewards?: string;
  lordsLocked?: string;
  currentAPY?: string;
}

interface FlywheelProps {
  metrics?: FlywheelMetrics;
}

const STEPS = [
  {
    icon: Gamepad2,
    label: "Play",
    detail: "LORDS spent in matches",
    metricKey: null as keyof FlywheelMetrics | null,
  },
  {
    icon: Coins,
    label: "Fees",
    detail: "Weekly game revenue",
    metricKey: "weeklyRewards" as keyof FlywheelMetrics | null,
  },
  {
    icon: Lock,
    label: "Stake",
    detail: "Locked as veLORDS",
    metricKey: "lordsLocked" as keyof FlywheelMetrics | null,
  },
  {
    icon: RefreshCw,
    label: "Earn",
    detail: "Staking yield",
    metricKey: "currentAPY" as keyof FlywheelMetrics | null,
  },
];

const CX = 200;
const CY = 200;
const R = 138;
const CIRC = 2 * Math.PI * R;

const NODE_SCREEN_DEGS = [270, 0, 90, 180];
const NODE_ORBIT_DEGS = [0, 90, 180, 270];

const NUM_PARTICLES = 3;
const ORBIT_SECS = 8;

function screenDegToXY(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

function orbitToScreen(orbit: number) {
  return (orbit + 270) % 360;
}

function chevronAt(screenDeg: number) {
  const pos = screenDegToXY(screenDeg);
  const tang = ((screenDeg + 90) * Math.PI) / 180;
  const s = 7;
  return {
    tip: {
      x: pos.x + s * Math.cos(tang),
      y: pos.y + s * Math.sin(tang),
    },
    l: {
      x: pos.x + s * Math.cos(tang + 2.5),
      y: pos.y + s * Math.sin(tang + 2.5),
    },
    r: {
      x: pos.x + s * Math.cos(tang - 2.5),
      y: pos.y + s * Math.sin(tang - 2.5),
    },
  };
}

const ARROW_DEGS = [315, 45, 135, 225];

export function LordsFlywheel({ metrics }: FlywheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<(HTMLDivElement | null)[]>([]);
  const tickerRef = useRef<gsap.Callback | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    let triggered = false;

    const ctx = gsap.context(() => {
      const ring = svg.querySelector(".fw-ring") as SVGElement | null;
      const dash = svg.querySelector(".fw-dash") as SVGElement | null;
      const arrows = svg.querySelectorAll<SVGElement>(".fw-arrow");
      const dots = svg.querySelectorAll<SVGElement>(".fw-dot");
      const glows = svg.querySelectorAll<SVGElement>(".fw-glow");
      const nodes = nodesRef.current.filter(Boolean) as HTMLDivElement[];

      if (!ring || !dash || dots.length === 0) return;

      gsap.set(ring, {
        attr: { "stroke-dasharray": CIRC, "stroke-dashoffset": CIRC },
      });
      gsap.set(dash, { opacity: 0 });
      gsap.set(arrows, { opacity: 0 });
      gsap.set([...dots, ...glows], { opacity: 0 });
      nodes.forEach((n) => gsap.set(n, { opacity: 0, scale: 0.7 }));

      const particles = Array.from({ length: NUM_PARTICLES }, (_, i) => ({
        orbit: (360 / NUM_PARTICLES) * i,
      }));

      function syncPositions() {
        particles.forEach((p, i) => {
          const sd = orbitToScreen(p.orbit);
          const { x, y } = screenDegToXY(sd);
          if (dots[i]) gsap.set(dots[i], { attr: { cx: x, cy: y } });
          if (glows[i]) gsap.set(glows[i], { attr: { cx: x, cy: y } });
        });
      }

      syncPositions();

      const cooldowns = new Set<number>();
      const PULSE_THRESHOLD = 16;

      function pulseNearbyNodes() {
        particles.forEach((p) => {
          const pOrbit = ((p.orbit % 360) + 360) % 360;
          NODE_ORBIT_DEGS.forEach((nod, ni) => {
            const diff = Math.abs(pOrbit - nod);
            const dist = Math.min(diff, 360 - diff);
            if (dist < PULSE_THRESHOLD && !cooldowns.has(ni)) {
              cooldowns.add(ni);
              const card = nodes[ni]?.querySelector(".fw-node-card");
              if (card) {
                gsap.to(card, {
                  scale: 1.08,
                  borderColor:
                    "color-mix(in oklab, var(--primary) 65%, transparent)",
                  duration: 0.3,
                  ease: "power2.out",
                });
                gsap.to(card, {
                  scale: 1,
                  borderColor:
                    "color-mix(in oklab, var(--primary) 20%, transparent)",
                  duration: 0.55,
                  ease: "power2.inOut",
                  delay: 0.3,
                });
              }
              gsap.delayedCall(ORBIT_SECS / 4 - 0.2, () =>
                cooldowns.delete(ni)
              );
            }
          });
        });
      }

      ScrollTrigger.create({
        trigger: container,
        start: "top 82%",
        once: true,
        onEnter: () => {
          if (triggered) return;
          triggered = true;

          const tl = gsap.timeline();

          tl.to(ring, {
            attr: { "stroke-dashoffset": 0 },
            duration: 1.4,
            ease: "power2.inOut",
          });

          tl.to(dash, { opacity: 1, duration: 0.35 }, "-=0.5");
          tl.to(
            arrows,
            { opacity: 1, duration: 0.3, stagger: 0.07 },
            "-=0.25"
          );

          nodes.forEach((node, i) => {
            tl.to(
              node,
              {
                opacity: 1,
                scale: 1,
                duration: 0.4,
                ease: "back.out(1.7)",
              },
              i === 0 ? "-=0.25" : "-=0.22"
            );
          });

          tl.to([...dots], { opacity: 1, duration: 0.35 }, "-=0.2");
          tl.to([...glows], { opacity: 0.5, duration: 0.35 }, "<");

          tl.add(() => {
            particles.forEach((p) => {
              gsap.to(p, {
                orbit: "+=360",
                duration: ORBIT_SECS,
                repeat: -1,
                ease: "none",
              });
            });

            const tick: gsap.Callback = () => {
              syncPositions();
              pulseNearbyNodes();
            };
            tickerRef.current = tick;
            gsap.ticker.add(tick);

            gsap.to(dash, {
              attr: { "stroke-dashoffset": -40 },
              duration: 2.5,
              repeat: -1,
              ease: "none",
            });

            gsap.fromTo(
              ring,
              { opacity: 1 },
              {
                opacity: 0.5,
                duration: 2.5,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
              }
            );
          });
        },
      });
    }, container);

    return () => {
      if (tickerRef.current) {
        gsap.ticker.remove(tickerRef.current);
        tickerRef.current = null;
      }
      ctx.revert();
    };
  }, []);

  const nodePositions = NODE_SCREEN_DEGS.map((d) => screenDegToXY(d));

  return (
    <div
      ref={containerRef}
      className="realm-panel realm-holo-card rounded-2xl border border-primary/20 bg-black/30 backdrop-blur-sm p-6 sm:p-10"
    >
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        <p className="realm-banner mb-3">The LORDS Flywheel</p>
        <p className="text-base sm:text-lg text-foreground/65 max-w-xl mx-auto leading-relaxed">
          A self-reinforcing loop — game activity drives staking rewards,
          staking rewards incentivize more play.
        </p>
      </div>

      {/* ── Desktop: animated circular flywheel ── */}
      <div className="hidden md:block">
        <div
          className="relative w-full max-w-[580px] mx-auto"
          style={{ aspectRatio: "1/1" }}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 400 400"
            className="absolute inset-0 w-full h-full"
            fill="none"
          >
            <defs>
              <filter
                id="fw-particle-glow"
                x="-100%"
                y="-100%"
                width="300%"
                height="300%"
              >
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Solid ring — rotated so draw starts from 12 o'clock */}
            <circle
              className="fw-ring"
              cx={CX}
              cy={CY}
              r={R}
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              style={{
                color:
                  "color-mix(in oklab, var(--primary) 28%, transparent)",
                transform: "rotate(-90deg)",
                transformOrigin: `${CX}px ${CY}px`,
              }}
            />

            {/* Dashed energy ring */}
            <circle
              className="fw-dash"
              cx={CX}
              cy={CY}
              r={R}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="8 12"
              fill="none"
              style={{
                color:
                  "color-mix(in oklab, var(--primary) 40%, transparent)",
              }}
            />

            {/* Arrow chevrons */}
            {ARROW_DEGS.map((deg, i) => {
              const { tip, l, r } = chevronAt(deg);
              return (
                <polygon
                  key={`arrow-${i}`}
                  className="fw-arrow"
                  points={`${tip.x},${tip.y} ${l.x},${l.y} ${r.x},${r.y}`}
                  fill="currentColor"
                  style={{
                    color:
                      "color-mix(in oklab, var(--primary) 45%, transparent)",
                  }}
                />
              );
            })}

            {/* Particle glows */}
            {Array.from({ length: NUM_PARTICLES }, (_, i) => (
              <circle
                key={`glow-${i}`}
                className="fw-glow"
                cx={CX}
                cy={CY - R}
                r={16}
                fill="currentColor"
                filter="url(#fw-particle-glow)"
                style={{
                  color:
                    "color-mix(in oklab, var(--primary) 25%, transparent)",
                }}
              />
            ))}

            {/* Particle dots */}
            {Array.from({ length: NUM_PARTICLES }, (_, i) => (
              <circle
                key={`dot-${i}`}
                className="fw-dot"
                cx={CX}
                cy={CY - R}
                r={5.5}
                fill="currentColor"
                style={{ color: "var(--primary)" }}
              />
            ))}
          </svg>

          {/* Step nodes */}
          {STEPS.map((step, i) => {
            const { x, y } = nodePositions[i];
            const leftPct = (x / 400) * 100;
            const topPct = (y / 400) * 100;
            const metricValue =
              step.metricKey && metrics?.[step.metricKey];

            return (
              <div
                key={step.label}
                ref={(el) => {
                  nodesRef.current[i] = el;
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: "clamp(120px, 28%, 160px)",
                }}
              >
                <div className="fw-node-card flex flex-col items-center rounded-xl border border-primary/20 bg-black/70 backdrop-blur-md px-3 py-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 border border-primary/25 mb-2">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-bold leading-tight tracking-wide">
                    {step.label}
                  </p>
                  {metricValue && (
                    <p className="text-base font-bold text-primary tabular-nums mt-1">
                      {metricValue}
                    </p>
                  )}
                  <p className="text-[11px] text-foreground/50 leading-snug mt-1">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Mobile: vertical linear flow ── */}
      <div className="md:hidden">
        <div className="flex flex-col gap-4">
          {STEPS.map((step, index) => {
            const metricValue =
              step.metricKey && metrics?.[step.metricKey];
            return (
              <div key={step.label} className="flex items-start gap-4">
                <div className="relative flex flex-col items-center">
                  <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 border border-primary/25 shrink-0">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className="w-px h-8 bg-gradient-to-b from-primary/30 to-primary/10 mt-1.5" />
                  )}
                </div>
                <div className="pt-2">
                  <p className="text-base font-bold leading-tight">
                    {step.label}
                  </p>
                  {metricValue && (
                    <p className="text-sm font-bold text-primary tabular-nums mt-0.5">
                      {metricValue}
                    </p>
                  )}
                  <p className="text-sm text-foreground/60 leading-snug mt-1">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-2.5 pl-[3.25rem] text-sm text-primary/55">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="uppercase tracking-[0.12em]">
              Cycle repeats weekly
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
