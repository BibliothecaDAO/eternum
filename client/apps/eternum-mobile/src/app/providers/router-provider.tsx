import { ROUTES } from "@/shared/consts/routes";
import { useAuth } from "@/shared/hooks/use-auth"; // You'll need to implement this hook
import { Navigate } from "@/shared/ui/navigate"; // You'll need to implement this component for redirects
import { Route, Switch } from "wouter";
import { routesConfig } from "../config/routes";
import { Layout } from "../ui/layout";

interface ProtectedRouteProps {
  component: React.ComponentType;
  layout?: boolean;
}

const ProtectedRoute = ({ component: Component, layout }: ProtectedRouteProps) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} />;
  }

  if (layout) {
    return (
      <Layout>
        <Component />
      </Layout>
    );
  }

  return <Component />;
};

export const RouterProvider = () => {
  return (
    <Switch>
      {routesConfig.map(({ path, component: Component, protected: isProtected, layout }) => (
        <Route
          key={path}
          path={path}
          component={() => (isProtected ? <ProtectedRoute component={Component} layout={layout} /> : <Component />)}
        />
      ))}
    </Switch>
  );
};
