import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";

export const FactoryV2Header = ({ onBack, onOpenLegacy }: { onBack: () => void; onOpenLegacy: () => void }) => {
  return (
    <section className="animate-fade-in-up px-4 pt-4 md:px-0 md:pt-0">
      <div className="flex flex-col gap-4 text-center md:items-center">
        <div className="mx-auto max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.32em] text-[#f4e6d0]/55">Factory V2</div>
          <h1 className="mt-2 text-[1.9rem] font-semibold tracking-tight text-[#fbf4ea] sm:text-[2.15rem] md:mt-3 md:text-4xl">
            Cleaner launch controls
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-[15px] leading-6 text-[#fbf4ea]/62 md:mt-3 md:text-sm">
            This version is built around two simple jobs: start a game, or check a game.
          </p>
        </div>

        <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#fbf4ea]/78 transition-colors hover:bg-white/10 hover:text-[#fbf4ea]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to home
          </button>

          <button
            type="button"
            onClick={onOpenLegacy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#fbf4ea]/78 transition-colors hover:bg-white/10 hover:text-[#fbf4ea]"
          >
            Open legacy factory
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};
