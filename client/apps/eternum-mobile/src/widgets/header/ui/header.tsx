import { ROUTES } from "@/shared/consts/routes";
import useStore from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { useMatches } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

// Route to title mapping
const routeTitles: Record<string, string> = {
  [ROUTES.BLITZ]: "Blitz Hub",
  [ROUTES.REALM]: "Realm",
  [ROUTES.TRADE]: "Trade",
  [ROUTES.CHAT]: "Chat",
  [ROUTES.SETTINGS]: "Settings",
  [ROUTES.LORDPEDIA]: "Lordpedia",
  [ROUTES.LEADERBOARD]: "Leaderboard",
  [ROUTES.MARKETS]: "Prediction Markets",
};

export function Header() {
  const matches = useMatches();
  const connector = useStore((state) => state.connector);
  const [_, setUserName] = useState<string | undefined>(undefined);
  const currentPath = matches.at(-1)?.pathname;

  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => setUserName(name));
    } catch (error) {
      console.error("Failed to get username:", error);
    }
  }, [connector]);

  const handleBack = () => {
    window.history.back();
  };

  const currentTitle =
    routeTitles[currentPath || ""] || (currentPath?.startsWith(ROUTES.MARKETS) ? "Prediction Markets" : "Eternum");

  if (currentPath === ROUTES.HOME) {
    return null;
  }

  return (
    <header className="border-b px-4 absolute">
      <div className="flex h-14 items-center justify-between relative">
        <Button variant="ghost" size="sm" onClick={handleBack} className="flex items-center space-x-2">
          <ArrowLeft size={16} />
        </Button>

        <h1 className="text-lg font-semibold absolute left-1/2 -translate-x-1/2">{currentTitle}</h1>

        {/* Spacer for centering */}
        <div className="w-16" />
      </div>
    </header>
  );
}
