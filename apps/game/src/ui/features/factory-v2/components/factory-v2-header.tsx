import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";

export const FactoryV2Header = ({ onBack }: { onBack: () => void }) => {
  return (
    <section className="animate-fade-in-up px-4 pt-4 md:px-0 md:pt-0">
      <div className="flex flex-col gap-6 text-center md:items-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-[1.9rem] font-semibold tracking-tight text-gold sm:text-[2.15rem] md:text-4xl">
            Create a game
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-6 text-gold/50 md:text-sm">
            Launch a new Eternum or Blitz world in a few steps. Pick your network, choose a preset, set the timing, and
            hit launch. You can also check on running games from here.
          </p>
        </div>

        <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-gold/40">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
            <span>Single game, series, or rotation</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/60" />
            <span>Persistent world</span>
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
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gold/15 bg-black/20 px-4 py-2.5 text-sm font-medium text-gold/70 backdrop-blur-[6px] transition-colors hover:bg-gold/10 hover:text-gold hover:border-gold/30"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to home
          </button>
        </div>
      </div>
    </section>
  );
};
