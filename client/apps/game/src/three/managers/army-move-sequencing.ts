import { ID } from "@bibliothecadao/types";

export function registerArmyMoveRequest(requestByEntity: Map<ID, number>, entityId: ID): number {
  const request = (requestByEntity.get(entityId) ?? 0) + 1;
  requestByEntity.set(entityId, request);
  return request;
}

export function shouldApplyArmyMoveRequest(requestByEntity: Map<ID, number>, entityId: ID, request: number): boolean {
  return requestByEntity.get(entityId) === request;
}

export function clearArmyMoveRequest(requestByEntity: Map<ID, number>, entityId: ID): void {
  requestByEntity.delete(entityId);
}
