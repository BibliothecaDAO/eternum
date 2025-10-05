import { useNavigate } from "react-router-dom";

interface LandingLayoutProps {
  backgroundImage: string;
}

export const LandingLayout = ({ backgroundImage }: LandingLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <img
          alt="Eternum background"
          src={backgroundImage}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-6 lg:px-12">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">Bibliotheca DAO</span>
          <h1 className="text-2xl font-semibold uppercase tracking-wide">Eternum</h1>
        </div>
        <button
          className="rounded-md border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white hover:text-white"
          onClick={() => navigate("/play")}
        >
          Enter World
        </button>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 text-center lg:px-0">
        <div className="rounded-3xl border border-white/10 bg-black/50 p-10 backdrop-blur">
          <h2 className="text-3xl font-semibold uppercase tracking-[0.4em] text-white">Welcome to Eternum</h2>
          <p className="mt-6 text-sm leading-relaxed text-white/70">
            Command your realm, forge alliances, and automate your empire. The upcoming landing experience will provide
            deep account management, curated automation templates, and faster ways to join the world.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <button
              className="rounded-md bg-white/20 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/30"
              onClick={() => navigate("/play")}
            >
              Enter Eternum
            </button>
            <p className="text-xs text-white/50">
              Need to prepare first? Review your account details and saved automations here soon.
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex flex-col items-center gap-2 px-6 py-6 text-xs text-white/50 lg:px-12">
        <span>Seasonal data syncs automatically when you enter the world.</span>
        <button
          className="underline transition hover:text-white"
          onClick={() => navigate("/play")}
        >
          Skip to world view
        </button>
      </footer>
    </div>
  );
};
