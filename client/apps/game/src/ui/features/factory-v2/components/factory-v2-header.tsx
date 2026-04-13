import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";

export const FactoryV2Header = ({ onBack, onOpenLegacy }: { onBack: () => void; onOpenLegacy: () => void }) => {
  return (
    <section className="animate-fade-in-up px-4 pt-4 md:px-0 md:pt-0">
      <div className="flex flex-col gap-6 text-center md:items-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-[1.9rem] font-semibold tracking-tight text-[#fbf4ea] sm:text-[2.15rem] md:text-4xl">
            Create a game
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-6 text-[#fbf4ea]/62 md:text-sm">
            Launch a new Eternum or Blitz world in a few steps. Pick your network, choose a preset, set the timing, and
            hit launch. You can also check on running games or manage indexers from here.
          </p>
        </div>

        <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-[#fbf4ea]/40">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
            <span>Single game, series, or rotation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60" />
            <span>Slot or mainnet</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500/60" />
            <span>Live run monitoring</span>
          </div>
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
