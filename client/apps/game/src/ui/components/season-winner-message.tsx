import { useUIStore } from "@/hooks/store/use-ui-store";

export const SeasonWinnerMessage = () => {
  const seasonWinner = useUIStore((state) => state.seasonWinner);

  if (!seasonWinner) return null;

  return (
    <>
      <div className="fixed left-1/2 transform -translate-x-1/2 z-50 w-[400px] md:w-[800px] top-[60px]">
        <div className="my-4 py-4 px-6 border-4 border-gold-600/70 rounded-xl bg-slate-900/70 shadow-xl shadow-gold-500/20 text-center">
          <div className="font-serif text-2xl md:text-3xl text-amber-400 animate-pulse tracking-wider leading-relaxed uppercase">
            the season is over.
            <br />
            {seasonWinner.name} and the {seasonWinner.guildName} tribe have conquered eternum
          </div>
        </div>
      </div>
    </>
  );
};
