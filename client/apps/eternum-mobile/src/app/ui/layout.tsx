import { ROUTES } from "@/shared/consts/routes";
import { useSyncPlayerStructures } from "@/shared/hooks/use-sync-player-structures";
import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";
import { usePlayerStructures } from "@bibliothecadao/react";
import { Outlet, useMatches } from "@tanstack/react-router";
import { useEffect } from "react";

export function Layout() {
  const playerStructures = usePlayerStructures();
  const matches = useMatches();
  const currentPath = matches.at(-1)?.pathname;

  // sync player structures
  useSyncPlayerStructures();

  useEffect(() => {
    console.log("playerStructures", playerStructures);
  }, [playerStructures]);

  const isHomePage = currentPath === ROUTES.HOME;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className={`flex-1 pb-20 ${!isHomePage ? "pt-0" : ""}`}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
