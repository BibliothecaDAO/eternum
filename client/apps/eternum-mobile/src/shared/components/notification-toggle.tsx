import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/shared/ui/drawer";
import { Bell, BellOff } from "lucide-react";
import { useState } from "react";
import { usePushNotifications } from "../hooks/use-push-notifications";
import { NotificationSettings } from "./notification-settings";

export function NotificationToggle() {
  const { isSupported, isSubscribed, checkPermission, subscribe, unsubscribe } = usePushNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const toggleNotifications = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      const permissionGranted = await checkPermission();
      if (permissionGranted) {
        await subscribe();
      } else {
        // If permission is not granted, open the settings drawer
        setIsOpen(true);
      }
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={isSubscribed ? toggleNotifications : undefined}
            title={isSubscribed ? "Disable notifications" : "Enable notifications"}
          >
            {isSubscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <div className="p-4">
            <NotificationSettings onClose={() => setIsOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
