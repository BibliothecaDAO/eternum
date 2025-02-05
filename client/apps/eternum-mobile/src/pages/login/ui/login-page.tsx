import { ROUTES } from "@/shared/consts/routes";
import { useAuth } from "@/shared/hooks/use-auth";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Navigate } from "@/shared/ui/navigate";
import { useLocation } from "wouter";

export function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated } = useAuth();

  const handleConnect = () => {
    login();
    setLocation(ROUTES.REALM);
  };

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to={ROUTES.REALM} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Eternum</CardTitle>
          <CardDescription>Please login to continue</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-center text-muted-foreground">Login functionality coming soon</p>
          <Button onClick={handleConnect} className="w-full">
            Connect
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
