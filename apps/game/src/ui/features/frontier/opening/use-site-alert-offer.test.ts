import { expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", () => ({
  notificationOwnerOf: () => "a",
  useIdentitySession: () => ({ session: null }),
}));
vi.mock("@/hooks/use-notification-preferences", () => ({ useNotificationPreferences: () => ({}) }));
vi.mock("@/shell/profile/this-device", () => ({ useThisDevice: () => ({}) }));
vi.mock("./opening-store", () => ({ seeLine: vi.fn() }));

import type { ThisDeviceState } from "@/shell/profile/this-device";
import { turnOnSiteAlert } from "./use-site-alert-offer";

const attempt = (input: {
  levelCarries?: boolean;
  saved?: boolean;
  state: ThisDeviceState;
  settles?: ThisDeviceState;
}) => {
  const saveLevel = vi.fn(async () => input.saved ?? true);
  const toggle = vi.fn(async () => input.settles ?? "on");
  return {
    saveLevel,
    toggle,
    outcome: turnOnSiteAlert({
      levelCarries: input.levelCarries ?? false,
      saveLevel,
      device: { state: input.state, toggle },
    }),
  };
};

it("is on only once the level is saved and the device is delivering", async () => {
  const done = attempt({ state: "off" });
  expect(await done.outcome).toBe("on");
  expect(done.saveLevel).toHaveBeenCalledWith("important");
  expect(done.toggle).toHaveBeenCalledTimes(1);
  // A level that already carries the alert is not saved again; a device already on is not toggled.
  const already = attempt({ levelCarries: true, state: "on" });
  expect(await already.outcome).toBe("on");
  expect(already.saveLevel).not.toHaveBeenCalled();
  expect(already.toggle).not.toHaveBeenCalled();
});

it("says what stood in the way instead of calling it done", async () => {
  expect(await attempt({ state: "off", saved: false }).outcome).toBe("preferences");
  expect(await attempt({ state: "off", settles: "blocked" }).outcome).toBe("blocked");
  expect(await attempt({ state: "off", settles: "off" }).outcome).toBe("device");
  expect(await attempt({ state: "install" }).outcome).toBe("install");
  expect(await attempt({ state: "unavailable" }).outcome).toBe("unavailable");
  // A refused browser permission is never retried by toggling.
  const refused = attempt({ state: "blocked" });
  expect(await refused.outcome).toBe("blocked");
  expect(refused.toggle).not.toHaveBeenCalled();
});
