import type { Signer } from "../config";

export class BuildingTransactions {
  constructor(private provider: any) {}

  async create(
    signer: Signer,
    props: {
      entityId: number;
      directions: number[];
      buildingCategory: number;
      useSimple: boolean;
    },
  ) {
    return this.provider.create_building({
      signer,
      entity_id: props.entityId,
      directions: props.directions,
      building_category: props.buildingCategory,
      use_simple: props.useSimple,
    });
  }

  async destroy(
    signer: Signer,
    props: {
      entityId: number;
      buildingCoord: { alt?: boolean; x: number; y: number };
    },
  ) {
    return this.provider.destroy_building({
      signer,
      entity_id: props.entityId,
      building_coord: props.buildingCoord,
    });
  }

  async pauseProduction(
    signer: Signer,
    props: {
      entityId: number;
      buildingCoord: { alt?: boolean; x: number; y: number };
    },
  ) {
    return this.provider.pause_production({
      signer,
      entity_id: props.entityId,
      building_coord: props.buildingCoord,
    });
  }

  async resumeProduction(
    signer: Signer,
    props: {
      entityId: number;
      buildingCoord: { alt?: boolean; x: number; y: number };
    },
  ) {
    return this.provider.resume_production({
      signer,
      entity_id: props.entityId,
      building_coord: props.buildingCoord,
    });
  }
}
