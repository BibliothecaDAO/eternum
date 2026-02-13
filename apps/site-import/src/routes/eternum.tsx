import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { generateMetaTags } from "@/lib/og-image";

const seasonPhases = [
  {
    title: "Season Opening",
    detail:
      "Expansion, map claims, and early positioning set the economic base for the campaign.",
  },
  {
    title: "Mid Campaign",
    detail:
      "Territory pressure rises through diplomacy, coordinated raids, and logistics control.",
  },
  {
    title: "Final Push",
    detail:
      "Late-season decisions decide standings as long-horizon strategy converges into endgame control.",
  },
];

const blitzTiers = ["Recruit", "Gladiator", "Warrior", "Elite"];

const eternumCadence = "Eternum -> Seasonal strategy over several weeks";
const blitzCadence = "Blitz -> 2hr RTS mode";

export const Route = createFileRoute("/eternum")({
  component: EternumPage,
  head: () => ({
    meta: generateMetaTags({
      title: "Eternum Season Console - Realms World",
      description:
        "Explore Eternum's seasonal structure and compare its long-form cadence against Blitz's short-form RTS loop.",
      path: "/eternum",
    }),
  }),
});

function EternumPage() {
  return (
    <>
      <section className="relative min-h-[100svh] overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover mix-blend-screen opacity-70 saturate-130 contrast-110 scale-[1.03]"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/og.jpg"
        >
          <source src="/videos/eternum-stub.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,rgba(244,198,124,0.28),transparent_40%),radial-gradient(circle_at_22%_78%,rgba(99,117,214,0.24),transparent_38%),linear-gradient(180deg,rgba(8,8,11,0.15),rgba(8,8,11,0.76))]" />

        <div className="relative z-10 min-h-[100svh] flex items-end sm:items-center">
          <div className="container mx-auto px-4 pb-10 sm:pb-0">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="max-w-3xl realm-panel p-6 sm:p-8"
            >
              <p className="realm-banner mb-4">Eternum Preview</p>
              <h1 className="realm-title text-3xl sm:text-5xl leading-tight">
                Seasonal Strategy Surface
              </h1>
              <p className="mt-4 text-foreground/85 text-base sm:text-lg max-w-2xl">
                Drop the final Eternum footage into <code>public/videos/eternum-stub.mp4</code>
                . Eternum is framed as the longer seasonal arc, while Blitz is the
                faster two-hour mode nested inside the broader campaign structure.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45 }}
            className="mb-8"
          >
            <p className="realm-banner mb-3">Cadence Contrast</p>
            <h2 className="realm-title text-2xl sm:text-4xl">Season vs Session Runtime</h2>
            <p className="mt-3 text-foreground/80 max-w-3xl">
              Eternum and Blitz target different time horizons inside the same ecosystem.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="realm-panel rounded-xl p-5 sm:p-6">
              <p className="realm-sigil mb-2">Eternum Timeline</p>
              <p className="text-lg sm:text-xl font-semibold text-foreground">
                {eternumCadence}
              </p>
              <p className="mt-2 text-sm text-foreground/75">
                Long-form strategy loop with persistent map state, compounding decisions,
                and social coordination over a full season.
              </p>
            </div>

            <div className="realm-panel rounded-xl p-5 sm:p-6">
              <p className="realm-sigil mb-2">Blitz Timeline</p>
              <p className="text-lg sm:text-xl font-semibold text-foreground">
                {blitzCadence}
              </p>
              <p className="mt-2 text-sm text-foreground/75">
                High-tempo tactical match window for quick execution, verification, and
                replayable competitive sessions.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative pb-10 sm:pb-14">
        <div className="container mx-auto px-4">
          <div className="realm-panel rounded-xl p-5 sm:p-6">
            <p className="realm-banner mb-4">Blitz Tiers In Season</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {blitzTiers.map((tier) => (
                <div key={tier} className="card-relic rounded-lg p-3 text-center">
                  <p className="realm-sigil">{tier}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative pb-16 sm:pb-24">
        <div className="container mx-auto px-4">
          <div className="realm-panel realm-grid-scan rounded-xl p-5 sm:p-6">
            <p className="realm-banner mb-4">Season Structure</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {seasonPhases.map((phase) => (
                <div key={phase.title} className="card-relic rounded-lg p-4">
                  <p className="realm-sigil mb-2">{phase.title}</p>
                  <p className="text-sm text-foreground/80">{phase.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
