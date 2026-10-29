import { useEffect, useState } from "react";

import { readPushDevice } from "./push-notification-client";

/**
 * This device's push id while it takes alerts for `owner`, else null: what chat tells a room it is seen on, so a
 * mention there skips this device alone. Read again when this device's alerts change.
 */
export const usePushDeviceId = (owner: string | null): string | null => {
  const [device, setDevice] = useState<{ owner: string; id: string } | null>(null);
  useEffect(() => {
    if (!owner || !("serviceWorker" in navigator)) return;
    let current = true;
    const read = () =>
      readPushDevice().then(
        (held) => {
          if (current) setDevice(held && held.state === "active" ? { owner: held.owner, id: held.id } : null);
        },
        () => {
          if (current) setDevice(null);
        },
      );
    void read();
    window.addEventListener("pushRegistrationChanged", read);
    return () => {
      current = false;
      window.removeEventListener("pushRegistrationChanged", read);
    };
  }, [owner]);
  return device && device.owner === owner ? device.id : null;
};
