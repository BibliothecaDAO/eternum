import { useAuthSync } from "@/shared/hooks/use-auth";
import useStore from "@/shared/store";
import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { syncMarketAndBankData, syncPlayerStructuresData } from "../dojo/sync";

export function Layout() {
  useAuthSync();
  const dojo = useDojo();
  const playerStructures = usePlayerStructures();
  const setLoading = useStore((state) => state.setLoading);

  useEffect(() => {
    syncPlayerStructuresData(dojo.setup, playerStructures, setLoading);
  }, [playerStructures.length]);

  useEffect(() => {
    syncMarketAndBankData(dojo.setup, setLoading);
  }, []);

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
