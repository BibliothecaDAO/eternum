import { useState } from "react";
import { Effect } from "effect";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { HeraldClient } from "@/services/herald";
import { IdentityApi } from "@/services/identity";
import { Wallet, type DiscoveredWallet } from "@/services/platform/wallet";
import { formatCountdown, portraitUrl } from "./format";
import { useMutation, useQuery } from "./hooks";
import { nextOpenGame } from "./next-game";
import { useNowSeconds, useSession } from "./session";

const BACKDROPS: Record<string, { src: string; deep?: boolean }> = {
  "/": { src: "/art/covers/vigil.webp" },
  "/play": { src: "/art/covers/arena.webp" },
  "/ranks": { src: "/art/covers/arena.webp" },
  "/profile": { src: "/art/covers/realmland.webp", deep: true },
  "/p": { src: "/art/covers/realmland.webp", deep: true },
};

const NAV_TABS = [
  { to: "/", label: "Home" },
  { to: "/ranks", label: "Ranks" },
  { to: "/profile", label: "Profile" },
] as const;

const backdropFor = (pathname: string) => {
  const key = Object.keys(BACKDROPS)
    .filter((prefix) => prefix !== "/" && pathname.startsWith(prefix))
    .sort((a, b) => b.length - a.length)[0];
  return BACKDROPS[key ?? "/"] ?? BACKDROPS["/"]!;
};

function WalletConnect() {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [choices, setChoices] = useState<DiscoveredWallet[] | null>(null);

  const connect = useMutation((walletId: string) =>
    Effect.gen(function* () {
      const wallet = yield* Wallet;
      const identity = yield* IdentityApi;
      yield* wallet.connect(walletId);
      return yield* identity.signIn;
    }),
  );

  const begin = useMutation(() => Effect.flatMap(Wallet, (wallet) => wallet.discover));

  const finish = (walletId: string) => {
    setChoices(null);
    void connect.run(walletId).then((session) => {
      if (!session) return;
      refresh();
      if (!session.hasChosenName) void navigate({ to: "/profile" });
    });
  };

  const open = () =>
    void begin.run().then((wallets) => {
      if (!wallets) return;
      if (wallets.length === 1) finish(wallets[0]!.id);
      else setChoices(wallets);
    });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={open}
        className="cut-sm border border-[#f7cf7e] bg-gradient-to-b from-amber-hot to-[#b8730a] px-5 py-3 font-heading text-[12.5px] font-semibold uppercase tracking-[0.12em] text-ink hover:brightness-110"
      >
        {connect.state.kind === "pending" ? "Signing in…" : "Enter the Realms"}
      </button>
      {choices !== null && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 border border-line bg-raised p-2">
          <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Choose a wallet</div>
          {choices.length === 0 && (
            <div className="px-2 py-2 text-[12.5px] text-muted">
              No Starknet wallet found — install Ready or Braavos.
            </div>
          )}
          {choices.map((wallet) => (
            <button
              key={wallet.id}
              type="button"
              onClick={() => finish(wallet.id)}
              className="flex w-full items-center gap-2 px-2 py-2 text-left text-[13px] hover:bg-inset"
            >
              {wallet.icon ? <img src={wallet.icon} alt="" className="h-5 w-5" /> : null}
              {wallet.name}
            </button>
          ))}
        </div>
      )}
      {connect.state.kind === "error" && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 border border-amber-deep bg-raised px-3 py-2 text-[12px] text-gold">
          The wallet sign-in did not complete. Try again.
        </div>
      )}
    </div>
  );
}

export function Frame() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { session, status } = useSession();
  const now = useNowSeconds();

  // One directory poll owns the chrome facts: the PLAY target and herald health.
  const directory = useQuery(() => Effect.flatMap(HeraldClient, (herald) => herald.directory), [], { pollMs: 30_000 });
  const games = directory.kind === "ok" ? directory.value.games : [];
  const next = nextOpenGame(games);
  const backdrop = backdropFor(pathname);

  return (
    <div className="min-h-full">
      <div className={`backdrop${backdrop.deep ? " deep" : ""}`} aria-hidden>
        <img src={backdrop.src} alt="" />
      </div>

      <nav className="sticky top-0 z-30 border-b border-line bg-gradient-to-b from-[#090705f8] to-[#090705db]">
        <div className="flex h-16 items-stretch gap-1.5 px-4">
          <Link to="/" className="mr-3 flex items-center">
            <img
              src="/art/marks/realms-crown.svg"
              alt="Realms"
              className="h-8 drop-shadow-[0_0_10px_rgba(223,170,84,0.35)]"
            />
          </Link>
          <Link
            to="/play"
            className="cut mr-4 flex flex-col items-center justify-center self-center border border-[#f7cf7e] bg-gradient-to-b from-amber-hot to-[#a96a08] px-7 py-2 shadow-[0_0_26px_rgba(227,144,1,0.45)] hover:brightness-110"
          >
            <span className="font-display text-[20px] tracking-[0.14em] text-ink">PLAY</span>
            {next ? (
              <span className="font-mono text-[8.5px] font-semibold tracking-[0.2em] text-ink">
                {next.name.toUpperCase()} · {formatCountdown(next.clock.start_main_at - now)}
              </span>
            ) : null}
          </Link>
          {NAV_TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className="relative flex items-center px-3.5 font-heading text-[13px] font-semibold uppercase tracking-[0.14em] text-muted hover:text-parchment [&.active]:text-amber-hot"
              activeProps={{ className: "active" }}
              activeOptions={{ exact: tab.to === "/" }}
            >
              {tab.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-2.5">
            {session ? (
              <Link
                to="/profile"
                className="cut-sm flex items-center gap-2.5 border border-line bg-inset py-1 pl-1 pr-3 hover:border-amber-deep"
              >
                <img
                  src={portraitUrl(session.portrait)}
                  alt=""
                  className="cut-sm h-10 w-10 border border-amber-deep object-cover"
                />
                <span className="text-left">
                  <b className="block text-[13px] font-semibold leading-tight">
                    {session.hasChosenName ? session.name : "Unnamed lord"}
                  </b>
                  <small className="font-mono text-[10px] tracking-[0.05em] text-sage">SIGNED IN</small>
                </span>
              </Link>
            ) : status === "ok" ? (
              <WalletConnect />
            ) : status === "unreachable" ? (
              <span className="border border-line-soft px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                Identity offline
              </span>
            ) : null}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1280px] px-5 pb-16 pt-6">
        <Outlet />
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-30 flex h-8 items-center gap-5 border-t border-line-soft bg-[#080604f5] px-4 font-mono text-[10.5px] tracking-[0.05em] text-faint">
        <span>
          <span className={directory.kind === "ok" ? "text-sage" : "text-coral"}>●</span> HERALD
          {directory.kind === "ok" ? ` · #${directory.value.confirmed_block}` : ""}
        </span>
        <span className="ml-auto">v0.1.0</span>
      </footer>
      <div className="vignette" aria-hidden />
    </div>
  );
}
