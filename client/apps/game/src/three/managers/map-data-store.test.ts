// Simple test file to verify MapDataStore functionality
import { MapDataStore } from './map-data-store';

// This is a basic usage example demonstrating how to use the MapDataStore
function exampleUsage() {
  // Initialize the store with a 5-minute refresh interval
  const mapStore = MapDataStore.getInstance(5 * 60 * 1000);

  // Example: Get all structures and armies
  const allData = mapStore.getAllMapEntities();
  console.log(`Found ${allData.structures.length} structures and ${allData.armies.length} armies`);

  // Example: Get a specific structure by ID
  const structure = mapStore.getStructureById(123);
  if (structure) {
    console.log(`Structure ${structure.entityId}:`);
    console.log(`- Type: ${structure.structureTypeName}`);
    console.log(`- Level: ${structure.level}`);
    console.log(`- Owner: ${structure.ownerName}`);
    console.log(`- Guard armies: ${structure.guardArmies.length}`);
    console.log(`- Active productions: ${structure.activeProductions.length}`);
  }

  // Example: Get a specific army by ID
  const army = mapStore.getArmyById(456);
  if (army) {
    console.log(`Army ${army.entityId}:`);
    console.log(`- Type: ${army.category}`);
    console.log(`- Tier: ${army.tier}`);
    console.log(`- Count: ${army.count}`);
    console.log(`- Stamina: ${army.stamina}`);
    console.log(`- Owner: ${army.ownerName}`);
  }

  // Example: Get entities within a radius
  const nearbyEntities = mapStore.getEntitiesInRadius(100, 100, 50);
  console.log(`Found ${nearbyEntities.structures.length} structures and ${nearbyEntities.armies.length} armies within radius`);

  // Example: Get all entities owned by a specific player
  const playerAddress = "0x123456789abcdef";
  const playerStructures = mapStore.getStructuresByOwner(playerAddress);
  const playerArmies = mapStore.getArmiesByOwner(playerAddress);
  console.log(`Player owns ${playerStructures.length} structures and ${playerArmies.length} armies`);
}

export { exampleUsage };