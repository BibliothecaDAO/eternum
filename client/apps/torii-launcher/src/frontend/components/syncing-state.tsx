import React, { useEffect, useMemo, useState } from "react";
import { RpcProvider } from "starknet";
import { IpcMethod } from "../../types";

const SYNC_INTERVAL = 4000;

export const SyncingState = React.memo(({ reset }: { reset: boolean }) => {
  const [gameSynced, setGameSynced] = useState(false);
  const [initialToriiBlock, setInitialToriiBlock] = useState<number | null>(null);
  const [receivedFirstBlock, setReceivedFirstBlock] = useState<number | null>(null);

  const [currentChainBlock, setCurrentChainBlock] = useState<number>(0);
  const [currentToriiBlock, setCurrentToriiBlock] = useState<number>(0);

  useEffect(() => {
    const requestStoredStateFirstBlock = async (receivedFirstBlock: number) => {
      const firstBlock = await window.electronAPI.invoke(IpcMethod.RequestFirstBlock, null);
      if (!firstBlock) {
        setInitialToriiBlock(receivedFirstBlock);
        await window.electronAPI.sendMessage(IpcMethod.SetFirstBlock, receivedFirstBlock);
      } else {
        setInitialToriiBlock(firstBlock);
      }
    };

    if (receivedFirstBlock) {
      requestStoredStateFirstBlock(receivedFirstBlock);
    }
  }, [receivedFirstBlock]);

  useEffect(() => {
    if (reset) {
      setGameSynced(false);
      setInitialToriiBlock(null);
      setReceivedFirstBlock(null);
      setCurrentChainBlock(0);
      setCurrentToriiBlock(0);
    }
  }, [reset]);

  const progress = useMemo(() => {
    if (initialToriiBlock === undefined || currentChainBlock === 0) {
      return 0;
    }
    if (currentChainBlock === initialToriiBlock) {
      setGameSynced(true);
      return 1;
    }

    const progress = (currentToriiBlock - initialToriiBlock) / (currentChainBlock - initialToriiBlock);
    if (Math.ceil(progress * 100) === 100) {
      setGameSynced(true);
    }
    console.log(progress);
    return progress;
  }, [currentToriiBlock, currentChainBlock, initialToriiBlock, reset]);

  useEffect(() => {
    const interval = setInterval(async () => {
      let currentBlock = await getChainCurrentBlock();
      setCurrentChainBlock(currentBlock);
    }, SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        let currentBlock = await getToriiCurrentBlock();
        setReceivedFirstBlock((prev) => (prev === null ? currentBlock : prev));
        setCurrentToriiBlock(currentBlock);
      } catch (error) {
        console.error("Error getting torii current block", error);
      }
    }, SYNC_INTERVAL);
    return () => {
      clearInterval(interval);
    };
  }, [reset]);

  return gameSynced ? (
    <div className="text-gold text-center text-xs noselect">
      Game is fully synced, <br />
      do not close this window
    </div>
  ) : (
    <div className="flex flex-col items-center noselect">
      <div className="text-gold text-center text-xs mb-4">
        Game is syncing, <br />
        do not close this window
      </div>
      <div className="w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold/50 to-gold transition-all duration-300 ease-out"
          style={{ width: `${Math.min(Math.max(progress * 100, 0), 100)}%` }}
        ></div>
      </div>
    </div>
  );
});

const getChainCurrentBlock = async () => {
  const provider = new RpcProvider({
    nodeUrl: "https://api.cartridge.gg/x/starknet/mainnet",
  });
  const block = await provider.getBlockNumber();
  return block;
};

const getToriiCurrentBlock = async () => {
  const sqlQuery = "SELECT head FROM contracts WHERE contract_type = 'WORLD' LIMIT 1;";
  const params = new URLSearchParams([["query", sqlQuery]]).toString();

  const toriiUrl = `http://localhost:8080/sql?${params}`;

  const response = await fetch(toriiUrl, {
    method: "GET",
  });
  const data = await response.json();
  return data[0].head;
};
