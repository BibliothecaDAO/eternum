import { motion } from "framer-motion";
import { Bot, Compass, Workflow, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

const pillars = [
  {
    icon: Compass,
    title: "Discover",
    copy: "The agent reads each game's state and identifies the strongest available path.",
  },
  {
    icon: Workflow,
    title: "Execute",
    copy: "From tactical turns to resource flows, actions are orchestrated with speed and consistency.",
  },
  {
    icon: ShieldCheck,
    title: "Adapt",
    copy: "As the ecosystem evolves, the agent updates its playbook and rolls out game by game.",
  },
];

export function AgentNativeSection() {
  return (
    <section className="relative py-20 sm:py-24">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute right-[-8%] top-1/2 -translate-y-1/2 h-52 w-52 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 lg:gap-12 items-start"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="rounded-2xl border border-primary/25 bg-black/30 backdrop-blur-md p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-primary/90 mb-4">
              Agent Native
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl leading-tight mb-5">
              One Agent,
              <span className="text-primary"> Every Realm.</span>
            </h2>
            <p className="text-base sm:text-lg text-foreground/80 max-w-2xl mb-7">
              We are launching an autonomous game agent for Realms players and
              rolling it out across games. It scouts state, acts decisively, and
              keeps improving as the ecosystem expands.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/games">
                  <Bot className="mr-2 h-4 w-4" />
                  Explore Ecosystem
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#ecosystem-atlas">View Live Atlas</a>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {pillars.map((pillar, index) => (
              <motion.article
                key={pillar.title}
                className="rounded-2xl border border-primary/20 bg-black/25 p-5"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.1, duration: 0.45 }}
              >
                <pillar.icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="text-xl font-semibold mb-2">{pillar.title}</h3>
                <p className="text-foreground/75">{pillar.copy}</p>
              </motion.article>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
