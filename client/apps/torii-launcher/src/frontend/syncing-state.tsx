import ProgressBar from "@ramonak/react-progress-bar";
import { useEffect, useMemo, useState } from "react";
import { RpcProvider } from "starknet";

let initialToriiBlock: number | undefined = undefined;
let gameSynced = false;

const SYNC_INTERVAL = 4000;

export const SyncingState = ({ reset }: { reset: boolean }) => {
  const [currentChainBlock, setCurrentChainBlock] = useState<number>(0);
  const [currentToriiBlock, setCurrentToriiBlock] = useState<number>(0);

  useEffect(() => {
    if (reset) {
      initialToriiBlock = undefined;
      gameSynced = false;
      setCurrentToriiBlock(0);
    }
  }, [reset]);

  const progress = useMemo(() => {
    if (initialToriiBlock === undefined || currentChainBlock === 0) {
      return 0;
    }
    if (currentChainBlock === initialToriiBlock) {
      gameSynced = true;
      return 1;
    }

    const progress = (currentToriiBlock - initialToriiBlock) / (currentChainBlock - initialToriiBlock);
    if (Math.ceil(progress * 100) === 100) {
      gameSynced = true;
    }
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
        console.log(`torii currentBlock ${currentBlock}`);
        if (initialToriiBlock === undefined) {
          initialToriiBlock = currentBlock;
        }
        setCurrentToriiBlock(currentBlock);
      } catch (error) {
        console.error("Error getting torii current block", error);
      }
    }, SYNC_INTERVAL);
    return () => {
      clearInterval(interval);
    };
  }, [reset]);

  return isNaN(progress) || gameSynced ? (
    <div className="text-gold text-center text-sm">
      Game is fully synced, <br />
      do not close this window
    </div>
  ) : (
    <div className="flex flex-col items-center">
      <div className="text-gold text-center text-sm mb-4">
        Game is syncing, <br />
        do not close this window
      </div>
      <ProgressBar
        className="text-base w-full"
        labelSize="9px"
        height="14px"
        completed={Math.ceil(progress * 100)}
        bgColor="#F6C297"
        borderRadius="10px"
      />
    </div>
  );
};

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
