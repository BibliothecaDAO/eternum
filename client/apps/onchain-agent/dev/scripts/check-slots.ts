import { EternumClient } from "@bibliothecadao/client";

const TORII_URL = "https://api.cartridge.gg/x/fruity-fruity-sandbox/torii";
const PLAYER = "0x62ba685f1d600ac7bda27e556b787548da32c7c0aa3ff5f58dddc07b9116f33";
const LEVEL_SLOTS: Record<number, number> = { 1: 6, 2: 18, 3: 36, 4: 60 };

async function main() {
  const client = await EternumClient.create({ toriiUrl: TORII_URL });
  const sql = client.sql as any;
  const gameConfig = await sql.fetchGameConfig();
  const allStructures = await sql.fetchPlayerStructures(PLAYER);

  const targets = allStructures.filter((s: any) => s.category === 1 || s.category === 5);
  const entityIds = targets.map((s: any) => Number(s.entity_id));
  const buildingRows = await sql.fetchBuildingsByStructures(entityIds);

  const byRealm = new Map<number, any[]>();
  for (const b of buildingRows) {
    const arr = byRealm.get(b.outer_entity_id) ?? [];
    arr.push(b);
    byRealm.set(b.outer_entity_id, arr);
  }

  for (const s of targets) {
    const eid = Number(s.entity_id);
    const level = s.level || 1;
    const maxSlots = LEVEL_SLOTS[level] ?? 6;
    const buildings = byRealm.get(eid) ?? [];

    const counts = new Map<number, number>();
    for (const b of buildings) {
      counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
    }

    let popUsed = 0;
    let popCapacity = 0;
    for (const [cat, count] of counts) {
      const config = gameConfig.buildingCosts[cat];
      if (config) {
        popUsed += config.populationCost * count;
        popCapacity += config.capacityGrant * count;
      }
    }

    const slotsUsed = buildings.length;
    const slotsLeft = maxSlots - slotsUsed;
    const type = s.category === 1 ? "Realm" : "Village";

    const buildingList = [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([k, v]) => `${k}×${v}`)
      .join(", ");

    console.log(
      `${type} ${eid}: level=${level}, slots=${slotsUsed}/${maxSlots} (${slotsLeft} left), ` +
      `pop=${popUsed}/${popCapacity}, buildings=[${buildingList}]`,
    );
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
