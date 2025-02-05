import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Eternum</CardTitle>
          <CardDescription>Please login to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">Login functionality coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
