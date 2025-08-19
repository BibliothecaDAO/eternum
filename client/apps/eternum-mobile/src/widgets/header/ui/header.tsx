import { ROUTES } from "@/shared/consts/routes";
import { Button } from "@/shared/ui/button";
import { useMatches, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

// Route to title mapping
const routeTitles: Record<string, string> = {
  [ROUTES.REALM]: "Realm",
  [ROUTES.TRADE]: "Trade",
  [ROUTES.CHAT]: "Chat",
  [ROUTES.SETTINGS]: "Settings",
  [ROUTES.LORDPEDIA]: "Lordpedia",
};

export function Header() {
  const navigate = useNavigate();
  const matches = useMatches();
  const currentPath = matches.at(-1)?.pathname;

  // Don't show header on home page
  if (currentPath === ROUTES.HOME) {
    return null;
  }

  const handleBack = () => {
    window.history.back();
  };
  const connector = useStore((state) => state.connector);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => setUserName(name));
    } catch (error) {
      console.error("Failed to get username:", error);
    }
  }, [connector]);

  const currentTitle = routeTitles[currentPath || ""] || "Eternum";

  return (
    <header className="border-b px-4">
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
