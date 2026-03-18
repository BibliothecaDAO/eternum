import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";

export const FactoryV2Header = ({ onBack, onOpenLegacy }: { onBack: () => void; onOpenLegacy: () => void }) => {
  return (
    <section className="animate-fade-in-up">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.32em] text-[#f4e6d0]/55">Factory V2</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#fbf4ea] md:text-4xl">
            Cleaner launch controls
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#fbf4ea]/62">
            This version is built around two simple jobs: start a game, or check a game.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#fbf4ea]/78 transition-colors hover:bg-white/10 hover:text-[#fbf4ea]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to home
          </button>

          <button
            type="button"
            onClick={onOpenLegacy}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#fbf4ea]/78 transition-colors hover:bg-white/10 hover:text-[#fbf4ea]"
          >
            Open legacy factory
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
