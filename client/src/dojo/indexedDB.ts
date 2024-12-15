import { Component, Metadata, Schema } from "@dojoengine/recs";
import { Entities } from "@dojoengine/torii-client";
import { setEntities } from "./dojojscopy";

const DB_NAME = "eternum-db";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  let db: IDBDatabase;

  return new Promise((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("entities")) {
        db.createObjectStore("entities", { keyPath: "id" });
      }
    };

    request.onsuccess = (event: Event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event: Event) => {
      console.error("Database error:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

async function syncEntitiesFromStorage<S extends Schema>(
  dbConnection: IDBDatabase,
  components: Component<S, Metadata, undefined>[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = dbConnection.transaction(["entities"], "readonly");
    const store = transaction.objectStore("entities");
    const request = store.getAll();

    request.onsuccess = () => {
      const entities = request.result;
      const entityMap: Entities = {};

      for (const entity of entities) {
        const { id, ...data } = entity;
        entityMap[id] = data;
      }

      setEntities(entityMap, components, false);

      resolve();
    };

    request.onerror = () => {
      console.log("Error fetching entities from storage:", request.error);
      reject(request.error);
    };
  });
}

async function insertEntitiesInDB(db: IDBDatabase, entities: Entities): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["entities"], "readwrite");
    const store = transaction.objectStore("entities");

    let error: Error | null = null;

    // Handle transaction completion
    transaction.oncomplete = () => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    transaction.onerror = () => {
      reject(transaction.error);
    };

    // Store each entity
    for (const [entityId, data] of Object.entries(entities)) {
      const entityData = {
        id: entityId,
        ...data,
      };

      const request = store.put(entityData);

      request.onerror = () => {
        error = request.error;
      };
    }
  });
}

async function clearCache() {
  Object.keys(localStorage)
    .filter((x) => x.endsWith("_query"))
    .forEach((x) => localStorage.removeItem(x));

  indexedDB.deleteDatabase(DB_NAME);
  location.reload();
}

export { clearCache, insertEntitiesInDB, openDatabase, syncEntitiesFromStorage };
