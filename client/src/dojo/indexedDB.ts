import { Component, Metadata, Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import { Clause, ToriiClient } from "@dojoengine/torii-client";

const DB_NAME = 'myGameCacheDB';
const DB_VERSION = 1;
let db: IDBDatabase;

// Type definitions for the game data structure
type PrimitiveValue = {
  type: 'primitive';
  type_name: string;
  value: string | number;
  key: boolean;
};

type EnumValue = {
  type: 'enum';
  type_name: string;
  value: {
    option: string;
    value: TupleValue;
  };
  key: boolean;
};

type TupleValue = {
  type: 'tuple';
  type_name: string;
  value: any[];
  key: boolean;
};

type ConfigValue = PrimitiveValue | EnumValue | TupleValue;

interface GameConfig {
  [key: string]: ConfigValue;
}

interface GameData {
  [configType: string]: GameConfig;
}

interface EntityData {
  [entityId: string]: GameData;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('entities')) {
        db.createObjectStore('entities', { keyPath: 'id' });
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

async function setEntity(entityId: string, data: GameData): Promise<void> {
  if (!db) {
    await openDatabase();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['entities'], 'readwrite');
    const store = transaction.objectStore('entities');

    const entityData = {
      id: entityId,
      ...data
    };

    const request = store.put(entityData);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getEntity(entityId: string): Promise<GameData | null> {
  if (!db) {
    await openDatabase();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['entities'], 'readonly');
    const store = transaction.objectStore('entities');
    const request = store.get(entityId);

    request.onsuccess = () => {
      const entity = request.result;
      if (!entity) {
        resolve(null);
        return;
      }

      // Remove the id field from the result as it's just for storage
      const { id, ...data } = entity;
      resolve(data);
    };

    request.onerror = () => reject(request.error);
  });
}

async function getAllEntities(): Promise<EntityData> {
  if (!db) {
    await openDatabase();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['entities'], 'readonly');
    const store = transaction.objectStore('entities');
    const request = store.getAll();

    request.onsuccess = () => {
      const entities = request.result;
      const entityMap: EntityData = {};
      
      entities.forEach((entity: any) => {
        const { id, ...data } = entity;
        entityMap[id] = data;
      });
      
      resolve(entityMap);
    };

    request.onerror = () => reject(request.error);
  });
}

async function setAllDbEntities(entities: EntityData): Promise<void> {
  if (!db) {
    await openDatabase();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['entities'], 'readwrite');
    const store = transaction.objectStore('entities');

    let completed = 0;
    const total = Object.keys(entities).length;
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
        ...data
      };

      const request = store.put(entityData);

      request.onerror = () => {
        error = request.error;
      };
    }
  });
}

export const getEntitiesByTime = async <S extends Schema>(
    client: ToriiClient,
    clause: Clause | undefined,
    components: Component<S, Metadata, undefined>[],
    limit: number = 100,
    logging: boolean = false
) => {
    console.log("Starting getEntities");
    let offset = 0;
    let continueFetching = true;

    
        const entities = await client.getEntities({
            limit,
            offset,
            clause,
            dont_include_hashed_keys: false,
            order_by: [],
        });

        console.log("entities", entities);

        if (logging) console.log(`Fetched ${entities} entities`);

        // set in cache
        await setAllDbEntities(entities as any);

        // set in recs
        setEntities(entities, components, logging);

        setLastSync(new Date(Date.now()).toISOString() + "+00:00");

        if (Object.keys(entities).length < limit) {
            continueFetching = false;
        } else {
            offset += limit;
        }
    
};

const setLastSync = (time: string) => {
  localStorage.setItem('lastSync', time);
}

const getLastSync = () => {
    console.log("lastSync", localStorage.getItem('lastSync'));
  return localStorage.getItem('lastSync');
}



export { getAllEntities, getEntity, getLastSync, openDatabase, setAllDbEntities, setEntity, setLastSync, type ConfigValue, type EntityData, type GameConfig, type GameData };

