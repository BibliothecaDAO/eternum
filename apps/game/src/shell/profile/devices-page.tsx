import { KEEP, PROFILE_WORDS } from "@/ui/design-system/kit/words";
import { useCallback, useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { openDirectoryShard } from "@/runtime/world/shards";
import { getShardRpcProvider } from "@/utils/shard-rpc-provider";
import { Icon } from "@/ui/design-system/icon";
import { AppButton, AppDialog, AppSetting } from "@/ui/design-system/kit/app-elements";
import {
  getOrCreateDeviceKey,
  readAccountDevices,
  revokeAccountDevice,
  type DeviceShard,
} from "@bibliothecadao/eternum";

import { useRealmsPlayer } from "../herald";
import { Loading } from "../loading";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";

const deviceShard = async (): Promise<DeviceShard> => {
  const shard = await openDirectoryShard();
  if (!shard) throw new Error("no_official_chain");
  return { ...shard, provider: getShardRpcProvider(shard.rpcUrl) };
};

/**
 * The account's devices with this one among them: a device signed in is the account's, whether or not its
 * registration has reached the shards' events yet (right after sign-in it may not have: qa-app-1 P3-5 read an empty
 * list). A device removed elsewhere never reaches this list; the page says it was removed instead.
 */
const withThisDevice = (devices: string[], thisDevice: string): string[] =>
  devices.some((device) => BigInt(device) === BigInt(thisDevice)) ? devices : [thisDevice, ...devices];

/** A device's name until the identity Worker stores names at registration: "Device" and its key's last four. */
const deviceName = (key: string) => PROFILE_WORDS.device(BigInt(key).toString(16).slice(-4));

/**
 * Devices (spec 11): each device with its name, This device ticked, Remove on the others; Remove asks first and
 * shows Removing… on its row while the page can be left.
 */
export const DevicesCard = ({ realmsId }: { realmsId: string }) => {
  const thisDevice = getOrCreateDeviceKey(localStorage).publicKey;
  const player = useRealmsPlayer();
  const address = player.data;
  const [devices, setDevices] = useState<string[] | null>(null);
  const [failed, setFailed] = useState<unknown>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!address) return;
    deviceShard()
      .then((shard) => readAccountDevices(address, shard))
      .then(
        (devices) => {
          setDevices(withThisDevice(devices, thisDevice));
          setFailed(null);
        },
        (cause: unknown) => setFailed(cause),
      );
  }, [address, thisDevice]);
  useEffect(load, [load]);

  const remove = async (deviceKey: string) => {
    setAsking(null);
    setRemoving(deviceKey);
    try {
      await revokeAccountDevice({
        shard: await deviceShard(),
        realmsId,
        device: getOrCreateDeviceKey(localStorage),
        deviceKey,
        approve: identityClient.approveDeviceChange,
      });
    } catch (cause) {
      setFailed(cause);
    }
    setRemoving(null);
    load();
  };

  if (player.isError || failed)
    return (
      <>
        {devices && <DeviceRows devices={devices} thisDevice={thisDevice} removing={removing} onRemove={setAsking} />}
        <div className="p-3">
          <ServiceFailure service="devices" error={player.error ?? failed} retry={load} />
        </div>
      </>
    );
  if (!devices) return <Loading />;
  return (
    <>
      <DeviceRows devices={devices} thisDevice={thisDevice} removing={removing} onRemove={setAsking} />
      {asking && (
        <AppDialog
          title={PROFILE_WORDS.removeAsk(deviceName(asking))}
          onClose={() => setAsking(null)}
          actions={
            <>
              <AppButton kind="quiet" onClick={() => setAsking(null)}>
                {KEEP}
              </AppButton>
              <AppButton kind="secondary" tone="bad" onClick={() => void remove(asking)}>
                {PROFILE_WORDS.remove}
              </AppButton>
            </>
          }
        >
          {PROFILE_WORDS.removeCost}
        </AppDialog>
      )}
    </>
  );
};

/** A device's row: its name, then This device ticked, or Remove (Removing… while it runs). */
const DeviceRows = ({
  devices,
  thisDevice,
  removing,
  onRemove,
}: {
  devices: string[];
  thisDevice: string;
  removing: string | null;
  onRemove: (device: string) => void;
}) =>
  devices.map((device) => {
    const own = BigInt(device) === BigInt(thisDevice);
    return (
      <AppSetting
        key={device}
        icon="monitor"
        name={own ? PROFILE_WORDS.thisDevice : deviceName(device)}
        control={
          own ? (
            <Icon name="check" size={22} />
          ) : (
            <AppButton
              kind="secondary"
              tone="bad"
              busy={removing === device ? PROFILE_WORDS.removing : undefined}
              disabled={removing !== null}
              onClick={() => onRemove(device)}
            >
              {PROFILE_WORDS.remove}
            </AppButton>
          )
        }
      />
    );
  });
