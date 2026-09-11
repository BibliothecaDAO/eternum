import { orders } from "@bibliothecadao/types";
import { BoxGeometry, Group, ImageLoader, Mesh, MeshStandardMaterial } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let SettlementAppearance: typeof import("./settlement-appearance").SettlementAppearance;

beforeEach(async () => {
  vi.resetModules();
  ({ SettlementAppearance } = await import("./settlement-appearance"));
});

const artwork = { width: 100, height: 100 } as HTMLImageElement;
function harness() {
  const context = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    globalCompositeOperation: "",
  };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
  const source = new Group();
  const bannerGeometry = new BoxGeometry();
  const trimGeometry = new BoxGeometry();
  const material = new MeshStandardMaterial();
  const bannerSource = new Mesh(bannerGeometry, material);
  bannerSource.userData.orderCloth = "banner";
  const trimSource = new Mesh(trimGeometry, material);
  trimSource.userData.orderCloth = "trim";
  source.add(bannerSource, trimSource);
  const banner = new Mesh(bannerGeometry, material.clone());
  const trim = new Mesh(trimGeometry, material.clone());
  const appearance = new SettlementAppearance(source, [banner, trim]);
  return {
    appearance,
    banner,
    trim,
    context,
    dispose: () => {
      appearance.dispose();
      banner.material.dispose();
      trim.material.dispose();
      material.dispose();
      bannerGeometry.dispose();
      trimGeometry.dispose();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("realm order heraldry", () => {
  it("uses the order's actual artwork and color, and keeps the newest selection when loads overlap", async () => {
    const pending: Array<(image: HTMLImageElement) => void> = [];
    const load = vi
      .spyOn(ImageLoader.prototype, "loadAsync")
      .mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    const model = harness();
    const first = model.appearance.setOrder(1);
    const latest = model.appearance.setOrder(7);
    expect(load).toHaveBeenCalledTimes(orders.length);
    for (const order of orders) {
      expect(load).toHaveBeenCalledWith(`/images/orders/${order.orderName.toLowerCase()}.png`);
    }
    for (const resolve of pending) resolve(artwork);
    await latest;
    const selected = model.banner.material.map;
    expect(selected?.name).toBe("Realm order heraldry");
    expect(`#${model.trim.material.color.getHexString()}`).toBe(
      orders.find((order) => order.orderId === 7)!.color.toLowerCase(),
    );
    expect(model.trim.material.map).toBeNull();
    await first;
    expect(model.banner.material.map).toBe(selected);
    expect(model.context.drawImage).toHaveBeenCalledOnce();
    model.dispose();
  });

  it("does not install late artwork after disposal and rejects unknown orders", async () => {
    const finishes: Array<(image: HTMLImageElement) => void> = [];
    vi.spyOn(ImageLoader.prototype, "loadAsync").mockImplementation(
      () =>
        new Promise((done) => {
          finishes.push(done);
        }),
    );
    const model = harness();
    await expect(model.appearance.setOrder(-1)).rejects.toThrow("Unknown realm order");
    const pending = model.appearance.setOrder(1);
    const placeholder = model.banner.material.map;
    const release = vi.spyOn(placeholder!, "dispose");
    model.appearance.dispose();
    for (const resolve of finishes) resolve(artwork);
    await pending;
    expect(model.banner.material.map).toBe(placeholder);
    expect(release).toHaveBeenCalledOnce();
    expect(model.context.drawImage).not.toHaveBeenCalled();
    model.dispose();
  });
});
