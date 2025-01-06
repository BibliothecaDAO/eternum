import { Position } from "@/types/Position";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import { ID } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { GUIManager } from "../helpers/GUIManager";
import { BattleSystemUpdate } from "../systems/types";
import { BattleModel } from "./BattleModel";
import { LabelManager } from "./LabelManager";

const LABEL_PATH = "textures/battle_label.png";

export class BattleManager {
  private scene: THREE.Scene;
  private battleModel: BattleModel;
  battles: Battles = new Battles();

  private labels: Map<ID, THREE.Points> = new Map();
  private labelManager: LabelManager;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.battleModel = new BattleModel(scene);
    this.labelManager = new LabelManager(LABEL_PATH, 1.5);

    const createBattleFolder = GUIManager.addFolder("Create Battle");
    const createBattleParams = { entityId: 0, col: 0, row: 0 };

    createBattleFolder.add(createBattleParams, "entityId").name("Entity ID");
    createBattleFolder.add(createBattleParams, "col").name("Column");
    createBattleFolder.add(createBattleParams, "row").name("Row");
    createBattleFolder
      .add(
        {
          addBattle: () => {
            this.addBattle(
              createBattleParams.entityId,
              new Position({ x: createBattleParams.col, y: createBattleParams.row }),
              false,
            );
          },
        },
        "addBattle",
      )
      .name("Add battle");
    createBattleFolder.close();

    const deleteBattleFolder = GUIManager.addFolder("Delete Battle");
    const deleteBattleParams = { entityId: 0 };
    deleteBattleFolder.add(deleteBattleParams, "entityId").name("Entity ID");
    deleteBattleFolder
      .add(
        {
          deleteBattle: () => {
            this.removeBattle(deleteBattleParams.entityId);
          },
        },
        "deleteBattle",
      )
      .name("Delete battle");
    deleteBattleFolder.close();
  }

  async onUpdate(update: BattleSystemUpdate) {
    await this.battleModel.loadPromise;

    const { entityId, hexCoords, isEmpty, deleted, isSiege, isOngoing } = update;

    if (deleted || !isOngoing) {
      this.removeBattle(entityId);
      return;
    }

    if (isEmpty) {
      if (this.battles.hasByEntityId(entityId)) {
        this.removeBattle(entityId);
        return;
      } else {
        return;
      }
    } else {
      this.addBattle(entityId, hexCoords, isSiege);
    }
  }

  addBattle(entityId: ID, hexCoords: Position, isSiege: boolean) {
    const normalizedCoord = hexCoords.getNormalized();
    const position = getWorldPositionForHex({ col: normalizedCoord.x, row: normalizedCoord.y });

    const index = this.battles.addBattle(entityId, hexCoords);

    this.battleModel.updateInstance(index, position);
    this.battleModel.mesh.count = this.battles.counter;
    this.battleModel.mesh.instanceMatrix.needsUpdate = true;
    this.battleModel.mesh.computeBoundingSphere();
    const label = this.labelManager.createLabel(
      position,
      isSiege ? new THREE.Color("yellow") : new THREE.Color("orange"),
    );

    this.labels.set(entityId, label);
    this.scene.add(label);
  }

  removeBattle(entityId: ID) {
    const meshMatrixIndex = this.battles.getBattleIndex(entityId);

    if (meshMatrixIndex === undefined) {
      // console.warn(`meshMatrixIndex not found for entityId ${entityId}`);
      return;
    }

    const newMatrix = new THREE.Matrix4().scale(new THREE.Vector3(0, 0, 0));
    this.battleModel.mesh.setMatrixAt(meshMatrixIndex, newMatrix);
    this.battleModel.mesh.instanceMatrix.needsUpdate = true;

    this.battles.removeBattle(entityId);

    const label = this.labels.get(entityId);

    if (!label) throw new Error(`Label not found for entityId ${entityId}`);

    this.labelManager.removeLabel(label, this.scene);
    this.labels.delete(entityId);
  }

  getAll() {
    return this.battles.getAll();
  }

  update(deltaTime: number) {
    this.battleModel.updateAnimations(deltaTime);
  }
}

class Battles {
  private battles: Map<ID, { index: number; position: Position }> = new Map();
  counter: number = 0;

  addBattle(entityId: ID, position: Position): number {
    if (!this.battles.has(entityId)) {
      this.battles.set(entityId, { index: this.counter, position });
      this.counter++;
    }
    return this.battles.get(entityId)!.index;
  }

  getBattleIndex(entityId: ID) {
    return this.battles.get(entityId)?.index;
  }

  hasByPosition(position: Position) {
    return Array.from(this.battles.values()).some((battle) => {
      const battlePosition = battle.position.getContract();
      const positionContract = position.getContract();
      return battlePosition.x === positionContract.x && battlePosition.y === positionContract.y;
    });
  }

  hasByEntityId(entityId: ID) {
    return this.battles.has(entityId);
  }

  removeBattle(entityId: ID) {
    this.battles.delete(entityId);
  }

  getAll() {
    return Array.from(this.battles.values());
  }
}
