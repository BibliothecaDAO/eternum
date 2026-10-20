import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const THIS_DEVICE = "0xd0e5";
// The shards' device events, as read right after signing in: this device's registration has not reached them yet.
const read = vi.hoisted(() => ({ devices: new Map<string, unknown[]>() }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  getOrCreateDeviceKey: () => ({ publicKey: "0xd0e5" }),
  readAccountDevices: async () => ({ devices: read.devices, failures: [] }),
}));
vi.mock("@/runtime/world/shards", () => ({ openKnownShards: async () => [], listOpenShards: () => [] }));
vi.mock("../herald", () => ({ useRealmsPlayer: () => ({ data: "0x7", isError: false }) }));

import { DevicesCard } from "./devices-page";

const rows = async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<DevicesCard realmsId="0x7" />));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  const text = container.textContent;
  await act(async () => root.unmount());
  container.remove();
  return { text };
};

it("lists this device among the account's devices right after signing in, before the shards record it (qa-app-1 P3-5)", async () => {
  read.devices = new Map();
  expect((await rows()).text).toContain("This device");
});

it("lists this device once, and the others with Remove, once the shards record it", async () => {
  read.devices = new Map([
    [THIS_DEVICE, []],
    ["0xbeef", []],
  ]);
  const { text } = await rows();
  expect(text?.match(/This device/g)).toHaveLength(1);
  expect(text).toContain("Remove");
});
