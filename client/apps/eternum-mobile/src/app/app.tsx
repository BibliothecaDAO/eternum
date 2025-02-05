import { LoginPage } from "@/pages/login";
import { RealmPage } from "@/pages/realm";
import { SettingsPage } from "@/pages/settings";
import { Route, Switch } from "wouter";
import { Layout } from "./ui/layout";
function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Switch>
        <Route path="/" component={LoginPage} />
        <Route path="/overview">
          <Layout>
            <RealmPage />
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
