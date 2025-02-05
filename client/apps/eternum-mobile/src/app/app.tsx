import { LoginPage } from "@/pages/login/ui/login-page";
import { OverviewPage } from "@/pages/overview/ui/overview-page";
import { SettingsPage } from "@/pages/settings/ui/settings-page";
import { Route, Switch } from "wouter";
import { Layout } from "./ui/layout";

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/overview">
          <Layout>
            <OverviewPage />
          </Layout>
        </Route>
        <Route path="/settings">
          <Layout>
            <SettingsPage />
          </Layout>
        </Route>
      </Switch>
    </div>
  );
}

export default App;
