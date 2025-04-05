import { NotificationSettings } from "@/shared/components/notification-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Separator } from "@/shared/ui/separator";
import { Switch } from "@/shared/ui/switch";
import { useState } from "react";

export function SettingsPage() {
  const [showBackgroundImage, setShowBackgroundImage] = useState(
    localStorage.getItem("showBackgroundImage") === "true",
  );

  const [notificationPreferences, setNotificationPreferences] = useState({
    attacks: true,
    resources: true,
    marketplace: true,
    system: true,
  });

  const handleBackgroundToggle = (checked: boolean) => {
    setShowBackgroundImage(checked);
    localStorage.setItem("showBackgroundImage", String(checked));
    // Reload to apply changes
    window.location.reload();
  };

  const updateNotificationPreference = (key: string, value: boolean) => {
    setNotificationPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
    // In a real app, you would save this to the user's profile
  };

  return (
    <div className="container p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Manage your notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <NotificationSettings />

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Notification Types</h3>
              <p className="text-xs text-muted-foreground">Choose which notifications you want to receive</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Attacks & Battles</p>
                    <p className="text-xs text-muted-foreground">
                      Notifications about realm attacks and battle outcomes
                    </p>
                  </div>
                  <Switch
                    checked={notificationPreferences.attacks}
                    onCheckedChange={(checked) => updateNotificationPreference("attacks", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Resource Updates</p>
                    <p className="text-xs text-muted-foreground">
                      Notifications when resources are ready or storage is full
                    </p>
                  </div>
                  <Switch
                    checked={notificationPreferences.resources}
                    onCheckedChange={(checked) => updateNotificationPreference("resources", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Marketplace</p>
                    <p className="text-xs text-muted-foreground">Notifications about trades and auctions</p>
                  </div>
                  <Switch
                    checked={notificationPreferences.marketplace}
                    onCheckedChange={(checked) => updateNotificationPreference("marketplace", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">System Updates</p>
                    <p className="text-xs text-muted-foreground">Game updates and maintenance notifications</p>
                  </div>
                  <Switch
                    checked={notificationPreferences.system}
                    onCheckedChange={(checked) => updateNotificationPreference("system", checked)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Display Settings</CardTitle>
            <CardDescription>Customize your visual experience</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Background Image</p>
                <p className="text-xs text-muted-foreground">Show decorative background image</p>
              </div>
              <Switch checked={showBackgroundImage} onCheckedChange={handleBackgroundToggle} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>Manage your account preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Account settings options coming soon</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
