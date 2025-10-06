export const LandingCosmetics = () => {
  return (
    <section className="w-full max-w-4xl space-y-6 rounded-3xl border border-white/10 bg-black/50 p-8 text-white backdrop-blur">
      <header>
        <h2 className="text-2xl font-semibold text-white">Cosmetics</h2>
        <p className="mt-2 text-sm text-white/70">
          Preview cosmetics, curate loadouts, and plan your next purchases. Structured sections and filters will live here.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-medium text-white">Featured Collections</h3>
          <p className="mt-1 text-sm text-white/70">
            Showcase curated bundles and seasonal drops pulled from the indexer.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-medium text-white">Loadout Planner</h3>
          <p className="mt-1 text-sm text-white/70">
            Review equipped cosmetics and prepare alternate looks without leaving the landing flow.
          </p>
        </div>
      </div>
    </section>
  );
};
