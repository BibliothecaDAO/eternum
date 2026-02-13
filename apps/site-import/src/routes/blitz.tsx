import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { FormEvent, MouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { Bot, Command, Send } from "lucide-react";
import { generateMetaTags } from "@/lib/og-image";
import { cn } from "@/lib/utils";

type TerminalLineKind = "system" | "input" | "agent";

interface TerminalLine {
  id: string;
  kind: TerminalLineKind;
  text: string;
}

const INITIAL_TERMINAL_LINES: TerminalLine[] = [
  {
    id: "boot-1",
    kind: "system",
    text: "Blitz Agent Console v0.1 booted. Type `help` to inspect commands.",
  },
  {
    id: "boot-2",
    kind: "agent",
    text: "Agent online. I can explain Blitz loops, agents, and cross-ecosystem handoffs.",
  },
];

const blitzPhases = [
  {
    id: "ingest",
    title: "State Ingest",
    detail:
      "Blitz pulls live combat state, roster conditions, and objective pressure in one snapshot.",
  },
  {
    id: "decide",
    title: "Tactical Decide",
    detail:
      "The planner agent scores candidate lines and chooses the action with best expected tempo.",
  },
  {
    id: "execute",
    title: "Execution",
    detail:
      "Action packets are issued with deterministic parameters so matches remain auditable.",
  },
  {
    id: "checkpoint",
    title: "Checkpoint",
    detail:
      "Results are published as structured events for replay, reward routing, and ecosystem sync.",
  },
];

const agentRoles = [
  {
    id: "scout",
    role: "Scout Agent",
    summary:
      "Detects map pressure, cooldown windows, and opponent posture before each decision turn.",
  },
  {
    id: "planner",
    role: "Planner Agent",
    summary:
      "Builds short tactical trees and picks the highest-value route based on current win conditions.",
  },
  {
    id: "executor",
    role: "Executor Agent",
    summary:
      "Converts strategy into concrete commands with strict guardrails and deterministic ordering.",
  },
  {
    id: "verifier",
    role: "Verifier Agent",
    summary:
      "Validates outcomes, signs checkpoints, and emits machine-readable state for downstream consumers.",
  },
];

const ecosystemSignals = [
  {
    id: "quests",
    label: "Quest Systems",
    value: "Live objective outcomes",
    description:
      "Campaign and mission systems can react to completed Blitz actions in near real-time.",
  },
  {
    id: "economy",
    label: "Economy & Rewards",
    value: "Verified action checkpoints",
    description:
      "Reward engines consume verifier output instead of ad-hoc logs, reducing payout ambiguity.",
  },
  {
    id: "identity",
    label: "Identity Graph",
    value: "Per-wallet play signatures",
    description:
      "Agent output enriches identity rails used by matchmaking, trust scoring, and progression.",
  },
];

const blitzTiers = [
  {
    id: "recruit",
    tier: "Recruit",
    summary:
      "Entry bracket for new commanders calibrating openings and tempo in short matches.",
  },
  {
    id: "gladiator",
    tier: "Gladiator",
    summary:
      "Mid-bracket with tighter timings where composition and reaction windows decide fights.",
  },
  {
    id: "warrior",
    tier: "Warrior",
    summary:
      "High-skill bracket focused on reliable execution and low-error tactical loops.",
  },
  {
    id: "elite",
    tier: "Elite",
    summary:
      "Top bracket where each two-hour run is optimized for precision, adaptation, and consistency.",
  },
];

function getCommandResponse(command: string): string[] {
  const normalized = command.trim().toLowerCase();

  switch (normalized) {
    case "help":
      return [
        "Available: help, blitz, agents, ecosystem, loop, status, clear",
        "Try `loop` for a short breakdown of an agent turn in Blitz.",
      ];
    case "blitz":
      return [
        "Blitz is a two-hour RTS mode with fast, agent-assisted combat cycles.",
        "Modes run in four brackets: Recruit, Gladiator, Warrior, and Elite.",
      ];
    case "agents":
      return [
        "Blitz agents are role-based: scout, planner, executor, and verifier.",
        "The verifier writes structured state so other games and services can consume the result.",
      ];
    case "ecosystem":
      return [
        "Cross-ecosystem flow: Blitz emits action logs, strategy metadata, and identity-linked outcomes.",
        "Other Realms surfaces can subscribe to that feed for rewards, quests, and progression sync.",
      ];
    case "loop":
      return [
        "Agent loop: ingest onchain state -> infer tactical objective -> choose command -> execute -> checkpoint.",
        "Checkpoint data is designed for composability across the wider Realms stack.",
      ];
    case "status":
      return [
        "Status: Video placeholder active. Agent simulation active. Awaiting Blitz footage drop-in.",
      ];
    default:
      return [
        `Unknown command: ${command}`,
        "Use `help` to see supported commands.",
      ];
  }
}

export const Route = createFileRoute("/blitz")({
  component: BlitzPage,
  head: () => ({
    meta: generateMetaTags({
      title: "Blitz Agent Console - Realms World",
      description:
        "Preview Blitz, the two-hour RTS mode, with a full-screen video stub and simulated agent CLI.",
      path: "/blitz",
    }),
  }),
});

function BlitzPage() {
  const [command, setCommand] = useState("");
  const [terminalLines, setTerminalLines] = useState(INITIAL_TERMINAL_LINES);
  const [isResponding, setIsResponding] = useState(false);
  const [isHeroAsciiActive, setIsHeroAsciiActive] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);
  const responseTimeoutsRef = useRef<number[]>([]);
  const heroAsciiOverlayRef = useRef<HTMLDivElement | null>(null);
  const heroAsciiRafRef = useRef<number | null>(null);
  const heroAsciiPendingRef = useRef({ x: 50, y: 50 });

  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [terminalLines]);

  useEffect(() => {
    return () => {
      responseTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      responseTimeoutsRef.current = [];
      if (heroAsciiRafRef.current !== null) {
        window.cancelAnimationFrame(heroAsciiRafRef.current);
        heroAsciiRafRef.current = null;
      }
    };
  }, []);

  const commitHeroAsciiPosition = useCallback(() => {
    const overlay = heroAsciiOverlayRef.current;
    if (!overlay) {
      heroAsciiRafRef.current = null;
      return;
    }

    overlay.style.setProperty("--ascii-x", `${heroAsciiPendingRef.current.x}%`);
    overlay.style.setProperty("--ascii-y", `${heroAsciiPendingRef.current.y}%`);
    heroAsciiRafRef.current = null;
  }, []);

  const handleHeroMouseMove = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const overlay = heroAsciiOverlayRef.current;
      if (!overlay) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      heroAsciiPendingRef.current = {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      };

      if (heroAsciiRafRef.current !== null) return;
      heroAsciiRafRef.current = window.requestAnimationFrame(commitHeroAsciiPosition);
    },
    [commitHeroAsciiPosition]
  );

  const handleHeroMouseEnter = useCallback(() => {
    setIsHeroAsciiActive(true);
  }, []);

  const handleHeroMouseLeave = useCallback(() => {
    setIsHeroAsciiActive(false);
  }, []);

  const queueResponse = (lines: string[]) => {
    setIsResponding(true);

    lines.forEach((line, index) => {
      const timeoutId = window.setTimeout(() => {
        setTerminalLines((prev) => [
          ...prev,
          {
            id: `agent-${Date.now()}-${index}`,
            kind: "agent",
            text: line,
          },
        ]);

        if (index === lines.length - 1) {
          setIsResponding(false);
        }
      }, 200 + index * 220);

      responseTimeoutsRef.current.push(timeoutId);
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    setCommand("");
    setTerminalLines((prev) => [
      ...prev,
      {
        id: `input-${Date.now()}`,
        kind: "input",
        text: `> ${trimmedCommand}`,
      },
    ]);

    if (trimmedCommand.toLowerCase() === "clear") {
      const timeoutId = window.setTimeout(() => {
        setTerminalLines([
          {
            id: `clear-${Date.now()}`,
            kind: "system",
            text: "Console cleared. Type `help` to continue.",
          },
        ]);
      }, 90);

      responseTimeoutsRef.current.push(timeoutId);
      return;
    }

    queueResponse(getCommandResponse(trimmedCommand));
  };

  return (
    <>
      <section
        className="relative min-h-[100svh] overflow-hidden"
        onMouseEnter={handleHeroMouseEnter}
        onMouseLeave={handleHeroMouseLeave}
        onMouseMove={handleHeroMouseMove}
      >
        <video
          className="absolute inset-0 h-full w-full object-cover mix-blend-screen opacity-70 saturate-140 contrast-110 scale-[1.03]"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/og.jpg"
        >
          <source src="/videos/blitz-stub.mp4" type="video/mp4" />
        </video>

        <div
          ref={heroAsciiOverlayRef}
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-300",
            isHeroAsciiActive ? "opacity-100" : "opacity-0"
          )}
          style={{
            // CSS vars are updated by RAF in mousemove handler.
            ["--ascii-x" as string]: "50%",
            ["--ascii-y" as string]: "50%",
          }}
        >
          <div className="realm-blitz-ascii-overlay absolute inset-0" />
          <div className="realm-blitz-hover-lens absolute inset-0" />
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(246,194,122,0.28),transparent_38%),radial-gradient(circle_at_24%_80%,rgba(109,123,216,0.24),transparent_40%),linear-gradient(180deg,rgba(8,8,11,0.14),rgba(8,8,11,0.72))]" />

        <div className="relative z-10 min-h-[100svh] flex items-end sm:items-center">
          <div className="container mx-auto px-4 pb-10 sm:pb-0">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="max-w-3xl realm-panel p-6 sm:p-8"
            >
              <p className="realm-banner mb-4">Blitz Preview</p>
              <h1 className="realm-title text-3xl sm:text-5xl leading-tight">
                Full-Screen Blitz Capture Placeholder
              </h1>
              <p className="mt-4 text-foreground/85 text-base sm:text-lg max-w-2xl">
                Drop your final Blitz video into <code>public/videos/blitz-stub.mp4</code>
                . Blitz is framed as a two-hour RTS run, with bracketed progression from
                Recruit to Gladiator, Warrior, and Elite.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45 }}
            className="mb-8"
          >
            <p className="realm-banner mb-3">Agent Walkthrough</p>
            <h2 className="realm-title text-2xl sm:text-4xl">
              Simulated CLI: Talk To A Blitz Agent
            </h2>
            <p className="mt-3 text-foreground/80 max-w-3xl">
              This terminal stub is where we will narrate how agents operate inside Blitz,
              and how their outputs move across the broader ecosystem.
            </p>
          </motion.div>

          <div className="realm-panel realm-grid-scan rounded-xl p-4 sm:p-6 border border-primary/35 bg-black/55">
            <div className="flex items-center justify-between gap-3 border-b border-primary/20 pb-3">
              <div className="flex items-center gap-2 text-primary/90">
                <Bot className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.2em] font-medium">
                  Agent Console
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-foreground/65 uppercase tracking-[0.14em]">
                <Command className="h-3.5 w-3.5" />
                {isResponding ? "Responding" : "Idle"}
              </div>
            </div>

            <div className="mt-4 h-[300px] sm:h-[360px] overflow-y-auto rounded-lg border border-primary/20 bg-black/50 px-3 py-3 font-mono text-[12px] sm:text-[13px] leading-6">
              {terminalLines.map((line) => (
                <p
                  key={line.id}
                  className={
                    line.kind === "input"
                      ? "text-primary"
                      : line.kind === "system"
                      ? "text-foreground/65"
                      : "text-foreground/90"
                  }
                >
                  {line.text}
                </p>
              ))}
              <div ref={terminalBottomRef} />
            </div>

            <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-primary/28 bg-black/60 px-3 py-2">
                <input
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  disabled={isResponding}
                  placeholder="Type a command (try: help)"
                  className="w-full bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-foreground/45"
                />
              </div>
              <button
                type="submit"
                disabled={isResponding}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-primary/35 bg-primary/15 text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
                aria-label="Send command"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45 }}
            className="mb-8"
          >
            <p className="realm-banner mb-3">Core Loop</p>
            <h2 className="realm-title text-2xl sm:text-4xl">How Blitz Works</h2>
            <p className="mt-3 text-foreground/80 max-w-3xl">
              Blitz is tuned around short, repeatable agent loops. Every match turn follows
              a deterministic cycle inside a two-hour session so players can inspect decisions
              and downstream systems can trust the output.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {blitzPhases.map((phase, index) => (
              <motion.article
                key={phase.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: index * 0.08 }}
                className="card-relic realm-holo-card"
              >
                <p className="realm-sigil mb-3">Phase 0{index + 1}</p>
                <h3 className="realm-title text-xl">{phase.title}</h3>
                <p className="mt-2 text-foreground/78 text-sm leading-6">{phase.detail}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45 }}
            className="mb-8"
          >
            <p className="realm-banner mb-3">Agent Stack</p>
            <h2 className="realm-title text-2xl sm:text-4xl">Agent Roles In Every Match</h2>
            <p className="mt-3 text-foreground/80 max-w-3xl">
              Each Blitz turn is split into specialized responsibilities. This keeps command
              output inspectable and makes adaptation easier without rewriting the full stack.
            </p>
          </motion.div>

          <div className="realm-journey-map">
            <div className="realm-journey-path" />
            <div className="space-y-4">
              {agentRoles.map((agent, index) => (
                <motion.article
                  key={agent.id}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.38, delay: index * 0.08 }}
                  className="realm-world-node card-relic sm:max-w-[88%]"
                >
                  <h3 className="realm-title text-xl">{agent.role}</h3>
                  <p className="mt-2 text-foreground/78 text-sm leading-6">{agent.summary}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45 }}
            className="mb-8"
          >
            <p className="realm-banner mb-3">Brackets</p>
            <h2 className="realm-title text-2xl sm:text-4xl">Recruit To Elite</h2>
            <p className="mt-3 text-foreground/80 max-w-3xl">
              Blitz sessions are grouped into four tiers so similar skill bands compete
              with comparable tempo and tactical depth.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {blitzTiers.map((entry, index) => (
              <motion.article
                key={entry.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: index * 0.07 }}
                className="card-relic realm-holo-card"
              >
                <p className="realm-sigil mb-3">{entry.tier}</p>
                <p className="text-sm text-foreground/80 leading-6">{entry.summary}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45 }}
            className="mb-8"
          >
            <p className="realm-banner mb-3">Integration</p>
            <h2 className="realm-title text-2xl sm:text-4xl">Across The Realms Ecosystem</h2>
            <p className="mt-3 text-foreground/80 max-w-3xl">
              Blitz is designed as a producer of high-fidelity gameplay signals that other
              systems can consume immediately.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {ecosystemSignals.map((signal, index) => (
              <motion.article
                key={signal.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: index * 0.08 }}
                className="realm-panel realm-grid-scan rounded-xl border border-primary/25 p-5"
              >
                <p className="realm-sigil mb-3">{signal.label}</p>
                <h3 className="realm-title text-lg">{signal.value}</h3>
                <p className="mt-2 text-foreground/78 text-sm leading-6">
                  {signal.description}
                </p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
