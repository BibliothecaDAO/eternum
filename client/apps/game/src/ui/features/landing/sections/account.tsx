export const LandingAccount = () => {
  return (
    <section className="w-full mb-2 max-w-3xl space-y-6 rounded-3xl border border-white/10 bg-black/50 p-8 text-white backdrop-blur">
      <header>
        <h2 className="text-2xl font-semibold text-white">Account</h2>
        <p className="mt-2 text-sm text-white/70">
          Manage Cartridge credentials, review linked wallets, and configure session preferences ahead of play.
        </p>
      </header>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-medium text-white">Authentication</h3>
          <p className="mt-1 text-sm text-white/70">
            Hooks into existing wallet providers and passwordless login flows will surface here.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-medium text-white">Profile Preview</h3>
          <p className="mt-1 text-sm text-white/70">
            Show currently selected avatars, titles, and progression snapshots for quick reference.
          </p>
        </div>
      </div>
    </section>
  );
};
