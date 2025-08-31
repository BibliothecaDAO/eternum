import { ROUTES } from "@/shared/consts/routes";
import { Card } from "@/shared/ui/card";
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
    name: "Realms",
    icon: "/images/icons/realms.png",
    route: ROUTES.REALM,
  },
  {
    id: "worldmap",
    name: "World Map",
    icon: "/images/icons/worldmap.png",
    route: ROUTES.WORLDMAP,
  },
  // {
  //   id: "armies",
  //   name: "Armies",
  //   icon: "/images/icons/armies.png",
  //   route: ROUTES.HOME, // dummy
  // },
  // {
  //   id: "resources",
  //   name: "Resources",
  //   icon: "/images/icons/resources.png",
  //   route: ROUTES.HOME, // dummy
  // },
  // {
  //   id: "amm",
  //   name: "Trade",
  //   icon: "/images/icons/amm.png",
  //   route: ROUTES.TRADE,
  // },
  // {
  //   id: "construction",
  //   name: "Construction",
  //   icon: "/images/icons/construction.png",
  //   route: ROUTES.HOME, // dummy
  // },
  // {
  //   id: "hyperstructures",
  //   name: "Hyperstructures",
  //   icon: "/images/icons/hyperstructures.png",
  //   route: ROUTES.HOME, // dummy
  // },
  // {
  //   id: "relics",
  //   name: "Relics",
  //   icon: "/images/icons/relics.png",
  //   route: ROUTES.HOME, // dummy
  // },
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
      <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
        {appIcons.map((app) => (
          <Link key={app.id} to={app.route} className="touch-manipulation">
            <Card className="p-4 hover:bg-muted/50 active:scale-95 transition-all duration-200 border-border/50">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center">
                  <img src={app.icon} alt={app.name} className="w-12 h-12 object-contain" loading="lazy" />
                </div>
                <span className="text-xs font-medium text-center leading-tight">{app.name}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Bottom spacing for footer */}
      <div className="h-20" />
    </div>
  );
}
