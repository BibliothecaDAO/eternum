import { ChatPage } from "@/pages/chat";
import { LoginPage } from "@/pages/login";
import { RealmPage } from "@/pages/realm";
import { SettingsPage } from "@/pages/settings";
import { TradePage } from "@/pages/trade";
import { ROUTES } from "@/shared/consts/routes";

interface RouteConfig {
  path: string;
  component: React.ComponentType;
  protected?: boolean;
  layout?: boolean;
}

export const routesConfig: RouteConfig[] = [
  {
    path: ROUTES.LOGIN,
    component: LoginPage,
    protected: false,
    layout: false,
  },
  {
    path: ROUTES.REALM,
    component: RealmPage,
    protected: true,
    layout: true,
  },
  {
    path: ROUTES.SETTINGS,
    component: SettingsPage,
    protected: true,
    layout: true,
  },
  {
    path: ROUTES.TRADE,
    component: TradePage,
    protected: true,
    layout: true,
  },
  {
    path: ROUTES.CHAT,
    component: ChatPage,
    protected: true,
    layout: true,
  },
];
