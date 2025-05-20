import { useSyncPlayerStructures } from "@/shared/hooks/use-sync-player-structures";
import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";
import { usePlayerStructures } from "@bibliothecadao/react";
import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

export function Layout() {
  const playerStructures = usePlayerStructures();

  // sync player structures
  useSyncPlayerStructures();

  useEffect(() => {
    console.log("playerStructures", playerStructures);
  }, [playerStructures]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
