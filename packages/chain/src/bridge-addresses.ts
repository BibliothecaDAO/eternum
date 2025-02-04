import { ChainId } from "./chains";

export const REALMS_BRIDGE_ADDRESS: Record<number | string, string> = {
    [ChainId.MAINNET]: "0xA425Fa1678f7A5DaFe775bEa3F225c4129cdbD25",
    [ChainId.SEPOLIA]: "0x345Eaf46F42228670489B47764b0Bd21f2141bd1",
    [ChainId.SN_MAIN]:
      "0x013ae4e41ff29ee8311c84b024ac59a0c13f73fa1ba0cea02fbbf7880ec4835a",
    [ChainId.SN_SEPOLIA]:
      "0x0467f6b080db9734b8b0a2ccb7fd020914e47f2f62aa668f56c4124946e4eb70",
  };

  export const LORDS_BRIDGE_ADDRESS: Record<number | string, string> = {
    [ChainId.MAINNET]: "0x023A2aAc5d0fa69E3243994672822BA43E34E5C9",
    [ChainId.SEPOLIA]: "0x6406465603487eE0Ad7A813b2bB6B0DFfB8f6aa7",
    [ChainId.SN_MAIN]:
      "0x7c76a71952ce3acd1f953fd2a3fda8564408b821ff367041c89f44526076633",
    [ChainId.SN_SEPOLIA]:
      "0x042331a29c53f6084f08964cbd83b94c1a141e6d14009052d55b03793b21d5b3",
  };
  
  export const STARKNET_MESSAGING =
  {
    [ChainId.MAINNET]: "0xc662c410C0ECf747543f5bA90660f6ABeBD9C8c4",
    [ChainId.SEPOLIA]: "0xe2bb56ee936fd6433dc0f6e7e3b8365c906aa057",
    [ChainId.SN_MAIN]: "",
    [ChainId.SN_SEPOLIA]: ""
  }