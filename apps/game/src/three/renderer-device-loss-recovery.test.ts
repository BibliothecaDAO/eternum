import { describe, expect, it, vi } from "vitest";

import { rebootAfterDeviceLoss } from "./renderer-device-loss-recovery";

const GAME = "https://play.realms.party/g/0x1/1/map?col=10&row=20";

/** A tab as the recovery sees it: whether it is in view, and where it is sent. */
const tab = (visibilityState: DocumentVisibilityState) => {
  const document = Object.assign(new EventTarget(), { visibilityState });
  const location = { href: GAME, replace: vi.fn() };
  const show = () => {
    document.visibilityState = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
  };
  return { page: { document, location } as unknown as Pick<Window, "document" | "location">, location, show };
};

describe("rebootAfterDeviceLoss", () => {
  it("boots a phone's tab again on its own route once it is seen, after its WebGL context was lost in the background", () => {
    const phone = tab("hidden");

    rebootAfterDeviceLoss("webgl2-fallback", phone.page);
    expect(phone.location.replace).not.toHaveBeenCalled();

    phone.show();
    expect(phone.location.replace.mock.calls).toEqual([[GAME]]);
    phone.show();
    expect(phone.location.replace).toHaveBeenCalledOnce();
  });

  it("boots a tab in view at once, on WebGL after a lost WebGPU device", () => {
    const desktop = tab("visible");

    rebootAfterDeviceLoss("webgpu", desktop.page);

    expect(desktop.location.replace.mock.calls).toEqual([[`${GAME}&rendererMode=webgpu-force-webgl`]]);
  });
});
