import { BlitzPage } from "@/pages/blitz";
import { ChatPage } from "@/pages/chat";
import { HomePage } from "@/pages/home";
import { LeaderboardPage } from "@/pages/leaderboard";
import { LoginPage } from "@/pages/login";
import { LordpediaPage } from "@/pages/lordpedia";
import { MarketDetailsPage, MarketsPage } from "@/pages/markets";
import { RealmPage } from "@/pages/realm";
import { SettingsPage } from "@/pages/settings";
import { TradePage } from "@/pages/trade";
import { WorldmapPage } from "@/pages/worldmap";
import { ROUTES } from "@/shared/consts/routes";
import { useAuth } from "@/shared/hooks/use-auth";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../ui/layout";

const ProtectedLayout = () => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }
  return <Layout />;
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path={ROUTES.HOME} element={<HomePage />} />
        <Route path={ROUTES.BLITZ} element={<BlitzPage />} />
        <Route path={ROUTES.LORDPEDIA} element={<LordpediaPage />} />
        <Route path={ROUTES.REALM} element={<RealmPage />} />
        <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
        <Route path={ROUTES.TRADE} element={<TradePage />} />
        <Route path={ROUTES.LEADERBOARD} element={<LeaderboardPage />} />
        <Route path={ROUTES.MARKETS} element={<MarketsPage />} />
        <Route path={ROUTES.MARKET_DETAILS} element={<MarketDetailsPage />} />
        <Route path={ROUTES.CHAT} element={<ChatPage />} />
        <Route path={ROUTES.WORLDMAP} element={<WorldmapPage />} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
    </Routes>
  );
};
