import { Launcher } from "./launcher";
import { NotificationsHandler } from "./notifications/notifications-handler";
import { Toaster } from "./notifications/toaster";

export const App = () => {
  return (
    <>
      <Toaster />
      <NotificationsHandler />
      <Launcher />
    </>
  );
};
