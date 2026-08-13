import {
  ToriiStreamManager,
  type BoundsDescriptor,
  type BoundsSwitchResult,
  type ToriiStreamManagerConfig,
} from "./torii-stream-manager";

export interface LegacyBoundedSyncAdapter {
  switchBounds: (descriptor: BoundsDescriptor) => Promise<BoundsSwitchResult>;
  forceResubscribe: (options?: { resetReadinessRecovery?: boolean }) => Promise<BoundsSwitchResult | null>;
  cancelCurrentSubscription: () => void;
  shutdown: () => void;
}

export const createLegacyBoundedSyncAdapter = (config: ToriiStreamManagerConfig): LegacyBoundedSyncAdapter =>
  new ToriiStreamManager(config);

export const switchLegacyBoundedSyncForCamera = async (
  adapter: LegacyBoundedSyncAdapter | null,
  descriptor: BoundsDescriptor,
): Promise<BoundsSwitchResult | null> => (adapter ? adapter.switchBounds(descriptor) : null);
