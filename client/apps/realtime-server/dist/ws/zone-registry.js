export const createZoneRegistry = () => {
    const zoneRooms = new Map();
    const socketZones = new WeakMap();
    const getOrCreateZoneSockets = (zoneId) => {
        let sockets = zoneRooms.get(zoneId);
        if (!sockets) {
            sockets = new Set();
            zoneRooms.set(zoneId, sockets);
        }
        return sockets;
    };
    const getOrCreateSocketZones = (ws) => {
        let zones = socketZones.get(ws);
        if (!zones) {
            zones = new Set();
            socketZones.set(ws, zones);
        }
        return zones;
    };
    const addSocketToZone = (ws, zoneId) => {
        getOrCreateZoneSockets(zoneId).add(ws);
        getOrCreateSocketZones(ws).add(zoneId);
    };
    const removeSocketFromZone = (ws, zoneId) => {
        const sockets = zoneRooms.get(zoneId);
        if (sockets) {
            sockets.delete(ws);
            if (sockets.size === 0) {
                zoneRooms.delete(zoneId);
            }
        }
        const zones = socketZones.get(ws);
        if (zones) {
            zones.delete(zoneId);
            if (zones.size === 0) {
                socketZones.delete(ws);
            }
        }
    };
    const removeSocketFromAllZones = (ws) => {
        const zones = socketZones.get(ws);
        if (!zones)
            return;
        for (const zoneId of Array.from(zones)) {
            removeSocketFromZone(ws, zoneId);
        }
    };
    const getSocketsForZone = (zoneId) => {
        return zoneRooms.get(zoneId) ?? new Set();
    };
    const getZonesForSocket = (ws) => {
        return socketZones.get(ws) ?? new Set();
    };
    return {
        addSocketToZone,
        removeSocketFromZone,
        removeSocketFromAllZones,
        getSocketsForZone,
        getZonesForSocket,
    };
};
//# sourceMappingURL=zone-registry.js.map