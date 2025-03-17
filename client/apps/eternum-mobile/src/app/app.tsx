import { useAuthSync } from "@/shared/hooks/use-auth";
import useStore from "@/shared/store";
import { useDojo, usePlayerStructures } from "@bibliothecadao/react";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { router } from "./config/router";
import { syncMarketAndBankData, syncPlayerStructuresData } from "./dojo/sync";

function App() {
  useAuthSync();
  const dojo = useDojo();
  const playerStructures = usePlayerStructures();
  const setLoading = useStore((state) => state.setLoading);
  const showBgImage = localStorage.getItem("showBackgroundImage") === "true";
  const randomCover = String(Math.floor(Math.random() * 7 + 1)).padStart(2, "0");
  const bgImage = `/images/covers/${randomCover}.png`;

  useEffect(() => {
    syncPlayerStructuresData(dojo.setup, playerStructures, setLoading);
  }, [playerStructures.length]);

  useEffect(() => {
    syncMarketAndBankData(dojo.setup, setLoading);
  }, []);

  return (
    <div className={`min-h-screen text-foreground relative ${!showBgImage ? "bg-background" : ""}`}>
      {showBgImage && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-50 -z-10"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
