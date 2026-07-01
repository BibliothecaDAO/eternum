import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Bot,
  Eye,
  Brain,
  Zap,
  ArrowRight,
  MessageSquare,
  RefreshCw,
  Swords,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

gsap.registerPlugin(ScrollTrigger);

const agentLoop = [
  {
    icon: Eye,
    title: "Observe",
    description: "Read the full game state in one snapshot.",
  },
  {
    icon: MessageSquare,
    title: "Report",
    description:
      "Send information, warnings, and strategic advice to a human player in real time.",
  },
  {
    icon: Brain,
    title: "Decide",
    description:
      "Score candidate moves and take action within strategic bounds.",
  },
  {
    icon: Zap,
    title: "Act",
    description:
      "Submit moves onchain. Every action is deterministic and auditable.",
  },
  {
    icon: RefreshCw,
    title: "Review",
    description:
      "Consider outcomes and learn from every victory and defeat.",
  },
];

const agentGames = [
  {
    icon: Swords,
    title: "Realms: Blitz",
    label: "Fast-paced Onchain Strategy",
    features: [
      "One-hour competitive matches, fast-paced gameplay.",
      "RTS-style development, movement and combat.",
      "Top-ranking players win a share of the $LORDS prize pool and build their MMR.",
    ],
    slug: "blitz",
  },
  {
    icon: Globe,
    title: "Eternum",
    label: "Seasonal Campaigns",
    features: [
      "Seasonal grand strategy games that unfold over several weeks.",
      "Join tribes, build religious followings, develop empires, and conquer the competition.",
      "Expansive economic gameplay with real stakes.",
    ],
    slug: "realms-eternum",
  },
];

const CX = 200;
const CY = 200;
const R = 128;
const CIRC = 2 * Math.PI * R;

const NODE_SCREEN_DEGS = [270, 342, 54, 126, 198];
const NODE_ORBIT_DEGS = [0, 72, 144, 216, 288];
const ARROW_DEGS = [306, 18, 90, 162, 234];
const NUM_PARTICLES = 4;
const ORBIT_SECS = 9;

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

function AgentLoopFlywheel() {
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
      const ring = svg.querySelector(".al-ring") as SVGElement | null;
      const dash = svg.querySelector(".al-dash") as SVGElement | null;
      const arrows = svg.querySelectorAll<SVGElement>(".al-arrow");
      const dots = svg.querySelectorAll<SVGElement>(".al-dot");
      const glows = svg.querySelectorAll<SVGElement>(".al-glow");
      const nodes = nodesRef.current.filter(Boolean) as HTMLDivElement[];

      if (!ring || !dash || dots.length === 0) return;

      gsap.set(ring, {
        attr: { "stroke-dasharray": CIRC, "stroke-dashoffset": CIRC },
      });
      gsap.set(dash, { opacity: 0 });
      gsap.set(arrows, { opacity: 0 });
      gsap.set([...dots, ...glows], { opacity: 0 });
      nodes.forEach((node) => gsap.set(node, { opacity: 0, scale: 0.7 }));

      const particles = Array.from({ length: NUM_PARTICLES }, (_, i) => ({
        orbit: (360 / NUM_PARTICLES) * i,
      }));

      function syncPositions() {
        particles.forEach((particle, index) => {
          const screenDeg = orbitToScreen(particle.orbit);
          const { x, y } = screenDegToXY(screenDeg);
          if (dots[index]) gsap.set(dots[index], { attr: { cx: x, cy: y } });
          if (glows[index]) gsap.set(glows[index], { attr: { cx: x, cy: y } });
        });
      }

      syncPositions();

      const cooldowns = new Set<number>();
      const PULSE_THRESHOLD = 15;

      function pulseNearbyNodes() {
        particles.forEach((particle) => {
          const orbit = ((particle.orbit % 360) + 360) % 360;
          NODE_ORBIT_DEGS.forEach((nodeOrbit, nodeIndex) => {
            const diff = Math.abs(orbit - nodeOrbit);
            const dist = Math.min(diff, 360 - diff);

            if (dist < PULSE_THRESHOLD && !cooldowns.has(nodeIndex)) {
              cooldowns.add(nodeIndex);
              const card = nodes[nodeIndex]?.querySelector(".al-node-card");

              if (card) {
                gsap.to(card, {
                  scale: 1.06,
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

              gsap.delayedCall(ORBIT_SECS / 5 - 0.2, () =>
                cooldowns.delete(nodeIndex),
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
          tl.to(arrows, { opacity: 1, duration: 0.3, stagger: 0.06 }, "-=0.25");

          nodes.forEach((node, index) => {
            tl.to(
              node,
              {
                opacity: 1,
                scale: 1,
                duration: 0.4,
                ease: "back.out(1.7)",
              },
              index === 0 ? "-=0.25" : "-=0.22",
            );
          });

          tl.to([...dots], { opacity: 1, duration: 0.35 }, "-=0.2");
          tl.to([...glows], { opacity: 0.5, duration: 0.35 }, "<");

          tl.add(() => {
            particles.forEach((particle) => {
              gsap.to(particle, {
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
              },
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

  const nodePositions = NODE_SCREEN_DEGS.map((deg) => screenDegToXY(deg));

  return (
    <div ref={containerRef}>
      <div className="hidden md:block">
        <div
          className="relative mx-auto w-full max-w-[700px]"
          style={{ aspectRatio: "1 / 1" }}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 400 400"
            className="absolute inset-0 h-full w-full"
            fill="none"
          >
            <defs>
              <filter
                id="agent-loop-particle-glow"
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

            <circle
              className="al-ring"
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

            <circle
              className="al-dash"
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

            {ARROW_DEGS.map((deg, index) => {
              const { tip, l, r } = chevronAt(deg);
              return (
                <polygon
                  key={`agent-arrow-${index}`}
                  className="al-arrow"
                  points={`${tip.x},${tip.y} ${l.x},${l.y} ${r.x},${r.y}`}
                  fill="currentColor"
                  style={{
                    color:
                      "color-mix(in oklab, var(--primary) 45%, transparent)",
                  }}
                />
              );
            })}

            {Array.from({ length: NUM_PARTICLES }, (_, index) => (
              <circle
                key={`agent-glow-${index}`}
                className="al-glow"
                cx={CX}
                cy={CY - R}
                r={16}
                fill="currentColor"
                filter="url(#agent-loop-particle-glow)"
                style={{
                  color:
                    "color-mix(in oklab, var(--primary) 25%, transparent)",
                }}
              />
            ))}

            {Array.from({ length: NUM_PARTICLES }, (_, index) => (
              <circle
                key={`agent-dot-${index}`}
                className="al-dot"
                cx={CX}
                cy={CY - R}
                r={5.5}
                fill="currentColor"
                style={{ color: "var(--primary)" }}
              />
            ))}
          </svg>

          {agentLoop.map((step, index) => {
            const { x, y } = nodePositions[index];
            const leftPct = (x / 400) * 100;
            const topPct = (y / 400) * 100;

            return (
              <div
                key={step.title}
                ref={(element) => {
                  nodesRef.current[index] = element;
                }}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: "168px",
                }}
              >
                <div className="al-node-card flex h-[140px] w-[168px] flex-col items-center justify-center rounded-lg border border-primary/20 bg-black/70 px-3 py-3 backdrop-blur-md">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-bold leading-tight tracking-wide">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-foreground/55">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="md:hidden">
        <div className="flex flex-col gap-4">
          {agentLoop.map((step, index) => (
            <div
              key={step.title}
              className="flex min-h-[120px] items-start gap-4 rounded-lg border border-primary/15 bg-black/35 p-4"
            >
              <div className="relative flex flex-col items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                {index < agentLoop.length - 1 && (
                  <div className="mt-1.5 h-8 w-px bg-gradient-to-b from-primary/30 to-primary/10" />
                )}
              </div>
              <div className="pt-2">
                <p className="text-base font-bold leading-tight">
                  {step.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/60">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2.5 pl-[3.25rem] text-sm text-primary/55">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="uppercase tracking-[0.12em]">
              Cycle repeats every match
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgentNativeSection() {
  return (
    <section className="realm-section relative overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          className="mx-auto mb-12 max-w-3xl text-center md:mb-16"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="realm-banner mx-auto mb-4 flex w-fit">
            <Bot className="h-3.5 w-3.5" />
            AGENT-NATIVE GAMING
          </p>
          <h2 className="realm-title mb-5 text-2xl leading-tight sm:text-3xl md:text-4xl">
            COMPETITIVE GAMES FOR HUMANS AND THEIR AGENTS
          </h2>
          <p className="realm-subtitle text-base sm:text-lg">
            Fully onchain games with the agentic era at the center of the
            design thesis.
          </p>
        </motion.div>

        <motion.div
          className="realm-panel mb-10 rounded-lg border border-primary/20 bg-black/30 p-6 backdrop-blur-sm sm:p-8 md:mb-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <p className="realm-banner mx-auto mb-8 flex w-fit text-center">
            THE AGENT LOOP
          </p>
          <AgentLoopFlywheel />
        </motion.div>

        <motion.div
          className="realm-panel rounded-lg border border-primary/20 bg-black/30 p-6 backdrop-blur-sm sm:p-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <p className="realm-banner mx-auto mb-8 flex w-fit text-center">
            FLAGSHIP AGENT-NATIVE GAMES
          </p>
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            {agentGames.map((game, index) => (
              <motion.div
                key={game.title}
                className="realm-panel realm-holo-card realm-edge-brackets flex flex-col rounded-lg border border-primary/20 bg-black/25 p-6 sm:p-7"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 + index * 0.1, duration: 0.5 }}
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <game.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{game.title}</h3>
                    <p className="realm-sigil">{game.label}</p>
                  </div>
                </div>

                <ul className="mb-5 flex-1 space-y-2.5">
                  {game.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/68"
                    >
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button size="sm" variant="oath" asChild>
                  <Link to="/games/$slug" params={{ slug: game.slug }}>
                    Learn More
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
