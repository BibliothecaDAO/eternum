import { NavLink, Outlet } from "react-router-dom";

import { ReactComponent as RealmsLogo } from "@/assets/icons/rw-logo.svg";
import { PwaInstallControl } from "@/pwa/pwa-install-control";
import { useBootDocumentState } from "@/ui/modules/boot-loader";
import { env } from "../../env";

import { useDirectory } from "./herald";
import { IdentityChip } from "./identity-chip";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/play", label: "Play", end: false },
  { to: "/results", label: "Results", end: false },
  { to: "/account", label: "Account", end: false },
] as const;

const FOOTER_LINKS = [
  { to: "/scroll", label: "Scroll" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
] as const;

const shardsSummary = (shards: readonly { available: boolean }[]): string => {
  const unavailable = shards.filter((shard) => !shard.available).length;
  return `${shards.length} listed${unavailable ? `, ${unavailable} unavailable` : ""}`;
};

/**
 * The app shell: every screen outside a game. It carries no three.js and no game asset; a game loads only under
 * `/g/:chain/:game`.
 */
export const AppShell = () => {
  useBootDocumentState("app-ready");
  const directory = useDirectory();

  return (
    <div className="flex min-h-screen flex-col bg-brown text-gold">
      <header className="sticky top-0 z-30 border-b border-gold/20 bg-brown/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center" aria-label="Realms home">
            <RealmsLogo className="h-8 w-8 text-gold" />
          </NavLink>
          <nav aria-label="Main navigation" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto sm:flex-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 font-cinzel text-[12px] font-semibold uppercase tracking-[0.14em] ${
                    isActive ? "bg-gold/15 text-gold" : "text-gold/60 hover:text-gold"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <PwaInstallControl />
            <IdentityChip />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6">
        <Outlet />
      </main>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-gold/10 px-4 py-2 font-mono text-[10.5px] tracking-[0.05em] text-gold/50">
        <span>
          <span className={directory.isSuccess ? "text-green" : "text-danger"}>●</span> Shards
          {directory.isSuccess
            ? ` · ${shardsSummary(directory.data.shards)}`
            : directory.isError
              ? " · unreachable"
              : ""}
        </span>
        <nav aria-label="About" className="flex gap-4">
          {FOOTER_LINKS.map((item) => (
            <NavLink key={item.to} to={item.to} className="hover:text-gold">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <span className="ml-auto">{env.VITE_PUBLIC_GAME_VERSION || "dev"}</span>
      </footer>
    </div>
  );
};
