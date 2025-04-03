import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { AlertTriangle, Bell, BellOff, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { showDirectNotification } from "../../register-sw";
import { usePushNotifications } from "../hooks/use-push-notifications";
import { testPushNotification } from "../lib/push-notification-api";

// In a real application, you would get this from your environment variables
const VAPID_PUBLIC_KEY = "BAl0gEcSdNwJ8QhJIh8HlSGVBMkMCwPOefDD58m3ILYudAIZaFDNOKOvb0-n7zO9P5a-f2WFFBqcN7wKnN0XGqc";

interface NotificationSettingsProps {
  onClose?: () => void;
}

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const { isSupported, isSubscribed, permissionState, subscribe, unsubscribe, checkPermission, error, subscription } =
    usePushNotifications(VAPID_PUBLIC_KEY);

  const [isEnabled, setIsEnabled] = useState(isSubscribed);
  const [isTesting, setIsTesting] = useState(false);
  const [isDirectTesting, setIsDirectTesting] = useState(false);

  useEffect(() => {
    setIsEnabled(isSubscribed);
  }, [isSubscribed]);

  const handleToggleNotifications = async () => {
    if (isEnabled) {
      await unsubscribe();
      setIsEnabled(false);
    } else {
      // First check permission
      const permissionGranted = await checkPermission();

      if (permissionGranted) {
        await subscribe();
        setIsEnabled(true);
      }
    }
  };

  const handleTestNotification = async () => {
    if (!subscription) {
      console.error("No subscription available for testing");
      return;
    }

    setIsTesting(true);
    try {
      const response = await testPushNotification(subscription);
      if (response.ok) {
        console.log("Test notification sent successfully");
      } else {
        const errorData = await response.json();
        console.error("Failed to send test notification:", errorData);
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
    } finally {
      setIsTesting(false);
    }
  };

  // Direct browser notification (bypassing push service)
  const handleDirectNotification = async () => {
    setIsDirectTesting(true);
    try {
      await showDirectNotification();
      console.log("Direct notification displayed");
    } catch (error) {
      console.error("Error showing direct notification:", error);
    } finally {
      setIsDirectTesting(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
        <Info className="h-5 w-5 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-medium">Push notifications are not supported</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your browser doesn't support push notifications or you're not using HTTPS.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {isEnabled ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Game Notifications</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {isEnabled
              ? "You'll receive notifications about important game events"
              : "Enable to receive notifications about important game events"}
          </p>
        </div>
        <Switch checked={isEnabled} onCheckedChange={handleToggleNotifications} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {isEnabled && (
          <Button variant="outline" size="sm" onClick={handleTestNotification} disabled={isTesting || !subscription}>
            {isTesting ? "Sending..." : "Test Push"}
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={handleDirectNotification} disabled={isDirectTesting}>
          {isDirectTesting ? "Sending..." : "Test Direct"}
        </Button>
      </div>

      {permissionState === "denied" && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-amber-500/10 text-amber-500">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-xs font-medium">Notification permission blocked</p>
            <p className="text-xs mt-1">You need to allow notifications in your browser settings.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="text-xs font-medium">Error</p>
            <p className="text-xs mt-1">{error.message}</p>
          </div>
        </div>
      )}

      {onClose && (
        <div className="flex justify-end mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
