export interface StarknetTokenBalance {
  balance: string;
  token_address: string;
  owner_address: string;
}

function hexToNumber(hex: string): number {
  // Remove '0x' prefix if present
  const cleanHex = hex.replace('0x', '');
  // Convert hex to decimal using BigInt to handle large numbers
  // Convert from gwei to ether by dividing by 10^9
  return Number(BigInt('0x' + cleanHex)) / 1e18;
}

export async function getLordsBalance(): Promise<number> {
    const response = await fetch(`https://starknet-mainnet.infura.io/v3/${import.meta.env.VITE_INFURA_APIKEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'starknet_call',
            params: [
                {
                    contract_address: '0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49',
                    entry_point_selector: '0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e',
                    calldata: ["0x047230028629128ac5bfbb384d32f925e70e329b624fc5d82e9c60f5746795cd"]
                },
                'latest'
            ],
            id: 1
        })
    });
    
    const data = await response.json();
    return hexToNumber(data.result[0]);
} 