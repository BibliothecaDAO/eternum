/* eslint-disable no-restricted-globals */

/**
 * UTILITIES ────────────────────────────────────────────────────────────────
 */

const DB_NAME = "eternum-automation";
const STORE = "rules";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
  });
}

async function getAllRules() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Mock helpers you must replace with real chain / API calls
 */
async function fetchBalances(realmId) {
  /* call your existing balance endpoint / contract here */
  return { wood: 123, stone: 456, gold: 789 };
}
async function createProductionOrder(rule) {
  /* sign + send tx using user's key (already in browser) */
  console.log("Service Worker: Preparing to request production order for rule:", rule);

  // Construct calldata with available information from the rule.
  // You'll need to adjust this based on what's actually stored in your rule object.
  const calldata = {
    // Assuming rule.realmId can be used for from_entity_id or similar.
    // Replace with actual fields from your rule object.
    from_entity_id: rule.realmId || 301, // Example: use rule.realmId or a default
    production_cycles: [rule.resourceId || 37], // Example: use rule.resourceId or a default
    produced_resource_types: [rule.resourceId || 6], // Example: use rule.resourceId or a default
    signerAddress: rule.accountAddress, // Use the stored accountAddress
  };

  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (clients && clients.length) {
    clients.forEach((client) => {
      client.postMessage({
        type: "CREATE_AUTOMATED_PRODUCTION_ORDER",
        payload: {
          ruleId: rule.id,
          calldata: calldata,
          // Pass any other necessary details from the rule to the client
          resourceId: rule.resourceId,
          realmId: rule.realmId,
        },
      });
    });
    console.log("Service Worker: Message sent to client(s) to create production order.");
  } else {
    console.error("Service Worker: No active client found to send production order request.");
    // Handle the case where no client is available (e.g., queue the task or log for later)
    // For now, we won't proceed with updating rule.produced as the order wasn't sent.
    return; // Exit if no client to send to
  }
  // IMPORTANT: The rule.produced count and saveRule(rule) should ideally be updated
  // only after the main client confirms the transaction was successful.
  // This would require a message back from the client to the service worker.
  // For now, we'll leave the optimistic update, but this is a point for future refinement.
}
function canProduce(rule, balances) {
  /* TODO: implement your input-recipe logic */
  return true;
}

/**
 * CORE LOOP ────────────────────────────────────────────────────────────────
 */

const TEN_MIN = 0.5 * 60 * 1_000;

async function tick() {
  try {
    const rules = await getAllRules();
    console.log("rules", rules);
    for (const rule of rules) {
      const balances = await fetchBalances(rule.realmId);
      if (canProduce(rule, balances) && rule.produced < rule.maxAmount) {
        // add account here
        await createProductionOrder(rule);
        rule.produced += 1; // simplistic – update per qty if needed
        await saveRule(rule);
      }
    }
  } catch (err) {
    console.error("[SW][AutoProduce]", err);
  }
}

async function saveRule(rule) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(rule);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

self.addEventListener("install", (evt) => {
  self.skipWaiting();
});
self.addEventListener("activate", (evt) => {
  evt.waitUntil(self.clients.claim());
  // start the loop
  tick();
  setInterval(tick, TEN_MIN);
});
