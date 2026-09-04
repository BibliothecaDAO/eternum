export const ICY_DRAGON_LEG_IDS = ["frontLeft", "frontRight", "hindLeft", "hindRight"] as const;
export type IcyDragonLegId = (typeof ICY_DRAGON_LEG_IDS)[number];

export interface IcyDragonLegRigDefinition {
  ankle: string;
  foot: string;
  hip: string;
  knee: string;
}

export interface IcyDragonRigAdapter {
  chest: string;
  head: string;
  id: "icy-dragon-gltf-v1";
  jaw: string;
  legs: Readonly<Record<IcyDragonLegId, IcyDragonLegRigDefinition>>;
  mouth: string;
  neck: readonly string[];
  root: string;
  saddle: string;
  tail: readonly string[];
  wings: Readonly<Record<"left" | "right", { outer: string; root: string; tips: readonly string[] }>>;
}

export const ICY_DRAGON_RIG_ADAPTER: IcyDragonRigAdapter = {
  chest: "Bone002_02",
  head: "Bone008_08",
  id: "icy-dragon-gltf-v1",
  jaw: "Bone009_09",
  legs: {
    frontLeft: { ankle: "Bone029_044", foot: "Bone074_050", hip: "Bone027_042", knee: "Bone028_043" },
    frontRight: { ankle: "Bone104_055", foot: "Bone088_059", hip: "Bone102_053", knee: "Bone103_054" },
    hindLeft: { ankle: "Bone032_067", foot: "Bone033_068", hip: "Bone030_065", knee: "Bone031_066" },
    hindRight: { ankle: "Bone078_072", foot: "Bone079_073", hip: "Bone076_070", knee: "Bone077_071" },
  },
  mouth: "Bone009_09",
  neck: ["Bone002_02", "Bone003_03", "Bone004_04", "Bone005_05", "Bone006_06", "Bone007_07"],
  root: "_rootJoint",
  saddle: "Bone001_01",
  tail: ["Bone016_076", "Bone018_078", "Bone020_080", "Bone022_082", "Bone024_084", "Bone026_086"],
  wings: {
    left: { outer: "Bone062_016", root: "Bone053_015", tips: ["Bone058_020", "Bone059_024", "Bone061_028"] },
    right: { outer: "Bone089_030", root: "Bone100_029", tips: ["Bone097_033", "Bone094_037", "Bone098_041"] },
  },
};

export function resolveIcyDragonRequiredBoneNames(adapter = ICY_DRAGON_RIG_ADAPTER): string[] {
  const names = new Set([adapter.root, adapter.chest, adapter.head, adapter.jaw, adapter.mouth, adapter.saddle]);
  adapter.neck.forEach((name) => names.add(name));
  adapter.tail.forEach((name) => names.add(name));
  Object.values(adapter.wings).forEach(({ outer, root, tips }) => {
    names.add(root);
    names.add(outer);
    tips.forEach((name) => names.add(name));
  });
  ICY_DRAGON_LEG_IDS.forEach((legId) => {
    Object.values(adapter.legs[legId]).forEach((name) => names.add(name));
  });
  return [...names].sort();
}
