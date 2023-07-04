export enum Entity {
    Realm = 'Realm',
    Army = 'Army'
}

// export interface Realm {
//     id: number;
//     name: string;
//     description: string;
//     owner: number;
//     armies: number[];
// }

export interface Realm {
    realm_id: number,
    resource_types_packed: number,
    resource_types_count: number,
    cities: number,
    harbors: number,
    rivers: number,
    regions: number,
    wonder: number,
    order: number,
}

export interface LaborConfig {
    base_labor_units: number;
    base_resources_per_cycle: number;
    base_food_per_cycle: number;
}

export interface Labor {
    balance: number;
    last_harvest: number;
    multiplier: number;
}

export interface EntityData {
    entityId: number;
    entityType: Entity;
}

export interface QueryResult<T> {
    data: T | undefined;
    loading: boolean;
    error: any;
}