import { useDojo } from "@/hooks/context/dojo-context";
import { ResourcesIds } from "@bibliothecadao/types";
import { useAccount } from "@starknet-react/core";
import { ArrowDownUp, Pickaxe } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { TypeH2 } from "../typography/type-h2";
import { Card, CardHeader } from "../ui/card";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { getResourceAddresses } from "../ui/utils/addresses";

type SortKey = "totalSupply" | "balance";
type SortDirection = "asc" | "desc";

export const BridgedResources = () => {
  const [sortKey, setSortKey] = useState<SortKey>("totalSupply");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [sortedResources, setSortedResources] = useState<Array<[string, [number, string]]>>([]);
  const [resourceData, setResourceData] = useState<Record<string, { totalSupply: bigint; balance: bigint }>>({});

  // todo: fix resources file with right resource id
  useEffect(() => {
    const getResources = async () => {
      const addresses = getResourceAddresses();
      setSortedResources(Object.entries(addresses));
    };
    void getResources();
  }, []);

  const updateResourceData = useCallback((address: string, totalSupply: bigint, balance: bigint) => {
    setResourceData((prev) => {
      if (prev[address]?.totalSupply === totalSupply && prev[address]?.balance === balance) {
        return prev;
      }
      return {
        ...prev,
        [address]: { totalSupply, balance },
      };
    });
  }, []);

  useEffect(() => {
    if (Object.keys(resourceData).length > 0) {
      setSortedResources((prev) =>
        [...prev].sort((a, b) => {
          const aData = resourceData[a[1][1]] || { totalSupply: 0n, balance: 0n };
          const bData = resourceData[b[1][1]] || { totalSupply: 0n, balance: 0n };
          const comparison = Number(bData[sortKey] - aData[sortKey]);
          return sortDirection === "desc" ? comparison : -comparison;
        }),
      );
    }
  }, [sortKey, sortDirection, resourceData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  return (
    <Card className="w-full bg-gray-900 border-gray-800">
      <CardHeader className="border-b border-gray-800">
        <div className="flex items-center justify-between">
          <TypeH2 className="flex items-center gap-3 uppercase text-gold">
            <Pickaxe className="w-6 h-6" />
            Bridged Resources
          </TypeH2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleSort("balance")}
              className={`text-sm flex items-center gap-2 ${sortKey === "balance" ? "text-gold" : "text-gold/70"}`}
            >
              <ArrowDownUp
                className={`w-4 h-4 ${sortKey === "balance" && sortDirection === "asc" ? "rotate-180" : ""}`}
              />
              Sort by Balance
            </button>
            <button
              onClick={() => handleSort("totalSupply")}
              className={`text-sm flex items-center gap-2 ${sortKey === "totalSupply" ? "text-gold" : "text-gold/70"}`}
            >
              <ArrowDownUp
                className={`w-4 h-4 ${sortKey === "totalSupply" && sortDirection === "asc" ? "rotate-180" : ""}`}
              />
              Sort by Supply
            </button>
          </div>
        </div>
      </CardHeader>
      <div className="divide-y divide-gray-800">
        {sortedResources.map(([key, [id, address]]) => (
          <BridgeResource
            key={key}
            resourceId={Number(id)}
            name={key}
            contractAddress={address.toString()}
            onDataUpdate={updateResourceData}
          />
        ))}
      </div>
    </Card>
  );
};

const BridgeResource = ({
  name,
  resourceId,
  contractAddress,
  onDataUpdate,
}: {
  name: string;
  resourceId: number;
  contractAddress: string;
  onDataUpdate: (address: string, totalSupply: bigint, balance: bigint) => void;
}) => {
  const {
    network: { provider },
  } = useDojo();
  const { account } = useAccount();

  const [amountBridged, setAmountBridged] = useState(0n);
  const [playerBalance, setPlayerBalance] = useState(0n);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get total supply
        const totalSupplyResult = await provider.provider.callContract({
          contractAddress: contractAddress,
          entrypoint: "total_supply",
        });
        const totalSupply = BigInt(totalSupplyResult[0]);
        setAmountBridged(totalSupply);

        // Get player balance
        let balance = 0n;
        if (account?.address) {
          const balanceResult = await provider.provider.callContract({
            contractAddress: contractAddress,
            entrypoint: "balance_of",
            calldata: [account.address],
          });
          balance = BigInt(balanceResult[0]);
          setPlayerBalance(balance);
        }

        onDataUpdate(contractAddress, totalSupply, balance);
      } catch (error) {
        console.error("Error fetching data:", error);
        setAmountBridged(0n);
        setPlayerBalance(0n);
        onDataUpdate(contractAddress, 0n, 0n);
      }
    };

    fetchData();
  }, [provider, contractAddress, account?.address, onDataUpdate]);

  const percentage = amountBridged > 0n ? Number((playerBalance * 100n) / amountBridged) : 0;
  const formattedBalance = (Number(playerBalance) / 10 ** 18).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formattedSupply = (Number(amountBridged) / 10 ** 18).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-6 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-6">
        <ResourceIcon size={"xxl"} resource={ResourcesIds[resourceId]} className="w-10 h-10" />
        <div className="space-y-1">
          <div className="font-bold text-lg text-white">
            <a
              href={`https://starkscan.co/token/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold transition-colors"
            >
              {name}
            </a>
          </div>
          <div className="text-sm text-gray-400">
            Balance: <span className="text-gold font-medium">{formattedBalance}</span>{" "}
            <span className="text-gray-500">({percentage.toFixed(1)}%)</span>
          </div>
          <button
            onClick={copyToClipboard}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-2 py-1 rounded transition-colors flex items-center gap-1"
            title="Click to copy contract address"
          >
            {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
            {copied ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-green-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm text-gray-400 mb-1">Total Supply</div>
        <div className="font-bold text-lg text-white">{formattedSupply}</div>
      </div>
    </div>
  );
};
