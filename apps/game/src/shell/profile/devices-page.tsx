import { useCallback, useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { listOpenShards, openKnownShards } from "@/runtime/world/shards";
import { getCachedRpcProvider } from "@/utils/cached-rpc-provider";
import { Button } from "@/ui/design-system/kit/button";
import {
  getOrCreateDeviceKey,
  readAccountDevices,
  revokeDeviceEverywhere,
  type DeviceShard,
} from "@bibliothecadao/eternum";

import { useRealmsPlayer } from "../herald";
import { Loading } from "../kit";
import { StateChip } from "../play/state-chip";
import { ServiceFailure } from "../service-failure";
import { PROFILE_WORDS } from "../words";
import { Confirm } from "./confirm";
import { SettingRow, SettingRows } from "./setting-row";

/** One device key and the shards where it signs for the player's account. */
interface Device {
  key: string;
  shards: DeviceShard[];
}

/**
 * The account's devices across every shard this client knows, read from each shard's device events at the player's
 * one address. A shard that could not be read makes the list partial, and the page says Devices did not answer.
 */
const readDevices = async (address: string) => {
  const unopened = await openKnownShards();
  const shards = listOpenShards().map((shard) => ({ ...shard, provider: getCachedRpcProvider(shard.rpcUrl) }));
  const { devices, failures } = await readAccountDevices(address, shards);
  return {
    devices: [...devices].map(([key, shards]): Device => ({ key, shards })),
    partial: unopened.length + failures.length > 0,
  };
};

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
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [failed, setFailed] = useState<unknown>(null);
  const [asking, setAsking] = useState<Device | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!address) return;
    readDevices(address).then(
      ({ devices, partial }) => {
        setDevices(devices);
        setFailed(partial ? "partial" : null);
      },
      (cause: unknown) => setFailed(cause),
    );
  }, [address]);
  useEffect(load, [load]);

  const remove = async (device: Device) => {
    setAsking(null);
    setRemoving(device.key);
    const failures = await revokeDeviceEverywhere({
      shards: device.shards,
      realmsId,
      device: getOrCreateDeviceKey(localStorage),
      deviceKey: device.key,
      approve: identityClient.approveDeviceChange,
    });
    setRemoving(null);
    if (failures.length > 0) setFailed(failures);
    load();
  };

  if (player.isError || failed)
    return (
      <div className="flex flex-col gap-3">
        {devices && <DeviceRows devices={devices} thisDevice={thisDevice} removing={removing} onRemove={setAsking} />}
        <ServiceFailure service="devices" error={player.error ?? failed} retry={load} />
      </div>
    );
  if (!devices) return <Loading />;
  return (
    <>
      <DeviceRows devices={devices} thisDevice={thisDevice} removing={removing} onRemove={setAsking} />
      {asking && (
        <Confirm
          question={PROFILE_WORDS.removeAsk(deviceName(asking.key))}
          cost={PROFILE_WORDS.removeCost}
          verb={PROFILE_WORDS.remove}
          onKeep={() => setAsking(null)}
          onConfirm={() => void remove(asking)}
        />
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
  devices: Device[];
  thisDevice: string;
  removing: string | null;
  onRemove: (device: Device) => void;
}) => (
  <SettingRows>
    {devices.map((device) => {
      const own = BigInt(device.key) === BigInt(thisDevice);
      return (
        <SettingRow
          key={device.key}
          icon="Dv"
          name={own ? PROFILE_WORDS.thisDevice : deviceName(device.key)}
          end={
            own ? (
              <StateChip icon="Ok" />
            ) : (
              <Button
                role="outline"
                word={PROFILE_WORDS.remove}
                loading={removing === device.key ? PROFILE_WORDS.removing : undefined}
                disabled={removing !== null}
                onClick={() => onRemove(device)}
              />
            )
          }
        />
      );
    })}
  </SettingRows>
);
