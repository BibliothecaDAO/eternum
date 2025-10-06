export const LandingLeaderboard = () => {
  return (
    <section className="w-full max-w-4xl space-y-6 rounded-3xl border border-white/10 bg-black/50 p-8 text-white backdrop-blur">
      <header>
        <h2 className="text-2xl font-semibold text-white">Leaderboard</h2>
        <p className="mt-2 text-sm text-white/70">
          Surface top players, alliances, and seasonal milestones without entering the full world UI.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-medium text-white">Highlights</h3>
          <p className="mt-1 text-sm text-white/70">
            Emphasize podium placements and recent leaderboard shifts to keep visitors engaged.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-medium text-white">Filters & Modes</h3>
          <p className="mt-1 text-sm text-white/70">
            Prepare hooks for timeframe toggles, realm types, and social leaderboards powered by the indexer.
          </p>
        </div>
      </div>
    </section>
  );
};
