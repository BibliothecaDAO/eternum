import { iconUrl, orderMeaning } from "@/ui/design-system/icon-meaning";
import { aspects, catalogOrder, orders } from "@bibliothecadao/types";
import {
  BoxGeometry,
  Color,
  Group,
  ImageLoader,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderStandard, resolveOrderSignumCell } from "./order-standard";
import { SettlementModel } from "./settlement-model";

vi.mock("../utils/contact-shadow", () => ({
  getContactShadowResources: () => ({ geometry: new PlaneGeometry(1, 1), material: new MeshStandardMaterial() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubCanvas() {
  const ops: string[] = [];
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: "",
    set globalCompositeOperation(value: string) {
      ops.push(value);
    },
    get globalCompositeOperation() {
      return ops.at(-1) ?? "source-over";
    },
  };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  return { context, ops };
}

function triangleCount(mesh: InstancedMesh): number {
  const { index } = mesh.geometry;
  return index ? index.count / 3 : mesh.geometry.getAttribute("position").count / 3;
}

describe("order stone signum", () => {
  it("stays under the 600-triangle budget, shares Realm placement, and paints Order cloth, Aspect finial and full-colour Facet cells", async () => {
    const { context, ops } = stubCanvas();
    const load = vi
      .spyOn(ImageLoader.prototype, "loadAsync")
      .mockResolvedValue({ width: 512, height: 512 } as HTMLImageElement);
    const host = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 4);
    host.count = 2;
    const signum = new OrderStandard(host);
    const totalTriangles = triangleCount(signum.body) + triangleCount(signum.cloth) + triangleCount(signum.emblem);
    expect(totalTriangles).toBeLessThanOrEqual(600);
    expect(signum.body.instanceMatrix).toBe(host.instanceMatrix);
    expect(signum.cloth.instanceMatrix).toBe(host.instanceMatrix);
    expect(signum.emblem.instanceMatrix).toBe(host.instanceMatrix);
    expect(signum.body.count).toBe(2);
    const finialAspect = signum.body.geometry.getAttribute("finialAspect");
    const presentFinials = new Set(Array.from({ length: finialAspect.count }, (_, index) => finialAspect.getX(index)));
    for (const entry of aspects) expect(presentFinials.has(entry.id)).toBe(true);

    await signum.prepare();
    expect(load).toHaveBeenCalledTimes(orders.length);
    for (const order of orders) {
      expect(load).toHaveBeenCalledWith(iconUrl(orderMeaning(order.orderId), 256));
    }
    expect(context.drawImage).toHaveBeenCalledTimes(orders.length);
    expect(ops).not.toContain("source-in");

    const power = catalogOrder(12);
    const fox = catalogOrder(4);
    signum.setOrderAt(0, power.orderId);
    signum.setOrderAt(1, fox.orderId);
    const aspect = signum.body.geometry.getAttribute("signumAspect");
    const cloth = signum.cloth.geometry.getAttribute("signumClothColor");
    const cell = signum.emblem.geometry.getAttribute("signumOrderCell");
    expect(aspect.getX(0)).toBe(power.aspect);
    expect(aspect.getX(1)).toBe(fox.aspect);
    expect(cell.getX(0)).toBe(resolveOrderSignumCell(power.orderId));
    expect(cell.getX(1)).toBe(resolveOrderSignumCell(fox.orderId));
    const powerColor = new Color(power.color);
    expect([cloth.getX(0), cloth.getY(0), cloth.getZ(0)]).toEqual([
      Math.fround(powerColor.r),
      Math.fround(powerColor.g),
      Math.fround(powerColor.b),
    ]);

    signum.setOrderAt(0, undefined);
    expect(aspect.getX(0)).toBe(0);
    expect(cell.getX(0)).toBe(resolveOrderSignumCell(undefined));

    const disposeBody = vi.spyOn(signum.body.geometry, "dispose");
    signum.dispose();
    signum.dispose();
    expect(disposeBody).toHaveBeenCalledOnce();
    host.geometry.dispose();
    (host.material as MeshStandardMaterial).dispose();
    host.dispose();
  });

  it("mounts beside Realms in SettlementModel and stays absent on Villages", () => {
    stubCanvas();
    const build = (kind: "realm" | "village") => {
      const scene = new Group();
      scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
      return new SettlementModel({ scene, animations: [] } as unknown as GLTF, 3, kind);
    };
    const realm = build("realm");
    const village = build("village");
    expect(realm.group.getObjectByName("Order stone signum")).toBeDefined();
    expect(village.group.getObjectByName("Order stone signum")).toBeUndefined();
    realm.setCount(2);
    const signum = realm.group.getObjectByName("Order stone signum")!;
    expect((signum.getObjectByName("Order signum stone") as InstancedMesh).count).toBe(2);
    realm.dispose();
    village.dispose();
  });

  it("supports standalone instanced placement for Deep sites and gates", () => {
    stubCanvas();
    const standards = OrderStandard.standalone(4);
    expect(standards.body.count).toBe(0);
    const matrix = new Matrix4().makeTranslation(3, 0, 5);
    standards.setMatrixAt(0, matrix);
    standards.setOrderAt(0, catalogOrder(12).orderId);
    standards.setCount(1);
    standards.needsUpdate();
    expect(standards.body.count).toBe(1);
    expect(standards.cloth.count).toBe(1);
    expect(standards.emblem.count).toBe(1);
    const read = new Matrix4();
    standards.cloth.getMatrixAt(0, read);
    expect(read.elements).toEqual(matrix.elements);
    standards.dispose();
  });
});
