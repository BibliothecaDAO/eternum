import React, { useEffect, useState } from "react";
import { ContainerLogStreamer } from "./streamer";

interface ContainerLogsProps {
  containerId: string;
}

export const ContainerLogs: React.FC<ContainerLogsProps> = ({
  containerId,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const logStreamer = new ContainerLogStreamer(containerId, {
      serverUrl: "ws://localhost:8000",
      onConnect: () => console.log("Connected to container logs"),
      onDisconnect: () => console.log("Disconnected from container logs"),
      onError: (error) => console.error("Error:", error),
      onLog: (log) => setLogs((prevLogs) => [...prevLogs, log]),
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectInterval: 5000,
      connectionTimeout: 10000, // 10 seconds
    });

    logStreamer.connect();

    return () => {
      logStreamer.disconnect();
    };
  }, [containerId]);

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="w-full h-full overflow-scroll">
      <div>Connection Status: {isConnected ? "Connected" : "Disconnected"}</div>
      <pre>{logs.join("\n")}</pre>
    </div>
  );
};
