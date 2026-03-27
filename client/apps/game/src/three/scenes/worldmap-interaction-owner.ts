let activeWorldmapInteractionOwnerInstanceId: number | null = null;

export function claimWorldmapInteractionOwner(instanceId: number): void {
  activeWorldmapInteractionOwnerInstanceId = instanceId;
}

export function releaseWorldmapInteractionOwner(instanceId: number): void {
  if (activeWorldmapInteractionOwnerInstanceId !== instanceId) {
    return;
  }

  activeWorldmapInteractionOwnerInstanceId = null;
}

export function isWorldmapInteractionOwner(instanceId: number): boolean {
  return activeWorldmapInteractionOwnerInstanceId === instanceId;
}

export function getWorldmapInteractionOwnerInstanceId(): number | null {
  return activeWorldmapInteractionOwnerInstanceId;
}

export function resetWorldmapInteractionOwnerForTests(): void {
  activeWorldmapInteractionOwnerInstanceId = null;
}
