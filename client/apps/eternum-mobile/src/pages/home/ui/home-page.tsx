import { ROUTES } from "@/shared/consts/routes";
import { Link } from "@tanstack/react-router";

interface AppIcon {
  id: string;
  name: string;
  icon: string;
  route: string;
}

const appIcons: AppIcon[] = [
  {
    id: "realms",
    name: "Realm",
    icon: "/images/icons/realms.png",
    route: ROUTES.REALM,
  },
  {
    id: "worldmap",
    name: "World Map",
    icon: "/images/icons/worldmap.png",
    route: ROUTES.HOME, // dummy
  },
  {
    id: "armies",
    name: "Armies",
    icon: "/images/icons/armies.png",
    route: ROUTES.HOME, // dummy
  },
  {
    id: "resources",
    name: "Resources",
    icon: "/images/icons/resources.png",
    route: ROUTES.HOME, // dummy
  },
  {
    id: "amm",
    name: "Trade",
    icon: "/images/icons/amm.png",
    route: ROUTES.TRADE,
  },
  {
    id: "construction",
    name: "Construction",
    icon: "/images/icons/construction.png",
    route: ROUTES.HOME, // dummy
  },
  {
    id: "hyperstructures",
    name: "Hyperstructures",
    icon: "/images/icons/hyperstructures.png",
    route: ROUTES.HOME, // dummy
  },
  {
    id: "relics",
    name: "Relics",
    icon: "/images/icons/relics.png",
    route: ROUTES.HOME, // dummy
  },
  {
    id: "lordpedia",
    name: "Lordpedia",
    icon: "/images/icons/lordpedia.png",
    route: ROUTES.LORDPEDIA,
  },
  {
    id: "chat",
    name: "Chat",
    icon: "/images/icons/chat.png",
    route: ROUTES.CHAT,
  },
  {
    id: "settings",
    name: "Settings",
    icon: "/images/icons/settings.png",
    route: ROUTES.SETTINGS,
  },
];

export function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6 pt-8">
      {/* App Icons Grid */}
      <div className="grid grid-cols-3 gap-6 max-w-sm mx-auto">
        {appIcons.map((app) => (
          <Link
            key={app.id}
            to={app.route}
            className="flex flex-col items-center space-y-2 p-3 rounded-2xl transition-all duration-200 hover:bg-muted/50 active:scale-95 touch-manipulation"
          >
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg bg-white/10 backdrop-blur-sm border-white/20 flex items-center justify-center">
              <img src={app.icon} alt={app.name} className="w-14 h-14 object-contain " loading="lazy" />
            </div>
            <span className="text-xs font-medium text-center text-foreground/90 leading-tight">{app.name}</span>
          </Link>
        ))}
      </div>

      {/* Bottom spacing for footer */}
      <div className="h-20" />
    </div>
  );
}
