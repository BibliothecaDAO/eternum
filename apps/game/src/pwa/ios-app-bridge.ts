import { distributionChannel } from "@/runtime/distribution-channel";

/**
 * What Capacitor's bridge puts on every page the iOS app (apps/ios) loads (its native-bridge.js). The page bundles no
 * Capacitor: it calls the app's plugins by name through this bridge, push (ios-app-push.ts) and haptics
 * (motion-settings.ts).
 */
export interface CapacitorBridge {
  isNativePlatform(): boolean;
  nativePromise<T>(plugin: string, method: string, options?: object): Promise<T>;
  addListener<T>(plugin: string, event: string, callback: (data: T) => void): { remove(): Promise<void> };
}

/** The bridge, when this page runs in the iOS app; null on the web and in the Android app. */
export const iosAppBridge = (): CapacitorBridge | null => {
  if (distributionChannel() !== "app-store") return null;
  const bridge = (window as { Capacitor?: Partial<CapacitorBridge> }).Capacitor;
  return bridge?.isNativePlatform?.() && bridge.nativePromise && bridge.addListener
    ? (bridge as CapacitorBridge)
    : null;
};
