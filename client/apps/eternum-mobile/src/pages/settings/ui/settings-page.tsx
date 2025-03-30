import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export function SettingsPage() {
  return (
    <div className="container p-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Game Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Game settings options coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Account settings options coming soon</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
